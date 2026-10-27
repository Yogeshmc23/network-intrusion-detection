#!/usr/bin/env python3
"""Binary IDS benchmark: Decision Tree vs Naive Bayes vs SVM (RBF).

This replaces the previous 14-model comparison (Logistic Regression, KNN,
Random Forest, Gradient Boosting, MLP, XGBoost, LightGBM, voting/stacking
ensembles, ...) with exactly the three models from ``ids_results.py``:

    Decision Tree : DecisionTreeClassifier(random_state=42)
    Naive Bayes   : GaussianNB()
    SVM (RBF)     : SVC(kernel="rbf", C=1.0)

Each model is run twice, as in ``ids_results.py``: once on all encoded
features and once keeping only the top-30 features most correlated with the
label. The candidate with the highest cross-validated F1 is refit on all
labeled data and saved as ``results/ids_model.joblib`` for ``app.py`` and
``web/ml-service``.

Supported inputs (same 41 NSL-KDD connection features either way)
------------------------------------------------------------------
1) Kaggle "Network Intrusion Detection" CSVs with a header:
   ``Train_data.csv`` (41 features + ``class`` = normal/anomaly) and
   ``Test_data.csv`` (41 features, no labels -- predictions only).
2) NSL-KDD text files without a header: ``KDDTrain+_20Percent.txt`` (or
   ``KDDTrain+.txt``) and ``KDDTest+.txt`` in the standard 43-column format
   (41 features + attack name + difficulty) or the 42-column variant.
   Every attack label is mapped to the positive anomaly class (1).

Train_data.csv / Test_data.csv are the CSV form of KDDTrain+_20Percent /
KDDTest+ (Test_data.csv is feature-identical to KDDTest+ with labels removed),
so ``--external-test data/KDDTest+.txt`` can be used alongside an unlabeled
``--test Test_data.csv`` to also score that same traffic against true labels.

Methodology notes (differences from the standalone ids_results.py)
-------------------------------------------------------------------
* Preprocessing is the deployment-safe equivalent of ids_results.py:
  one-hot encoding of protocol_type/service/flag, constant-column removal,
  then StandardScaler before the classifier. Here the encoder is fitted on
  training data only (OneHotEncoder, unknown categories ignored) instead of
  on train+test concatenated, so the whole pipeline can be saved with joblib
  and applied to single records by app.py / web/ml-service.
* Top-30 selection uses SelectKBest(f_classif) inside the pipeline. For a
  binary label on complete data, ranking by ANOVA F is monotonically
  equivalent to ranking by |Pearson r(feature, y)|, and putting the selector
  inside the pipeline means it is refit inside every CV fold (no leakage).
  ids_results.py computes correlations once on all labeled rows.
* Cross-validation (5-fold stratified by default, as in ids_results.py) is
  computed on the 80% fitting subset only, so model selection never uses the
  20% holdout. The selected model is then refit on 100% of labeled rows.
* Only the classifiers' default operating point is reported (probability
  threshold 0.5 for Decision Tree / Naive Bayes; decision boundary 0.0 for
  SVM), matching ids_results.py's use of ``predict``. The previous
  recall-target threshold calibration and hyperparameter search were removed
  together with the old models (--n-iter / --target-recall are still accepted
  for backward compatibility but ignored; --synthetic was removed).

Example
-------
    python cybersecurity_ids_study.py \\
        --train Train_data.csv --test Test_data.csv \\
        --external-test data/KDDTest+.txt --out results --cv 5
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import platform
import sys
import time
from pathlib import Path
from typing import Any

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.feature_selection import SelectKBest, VarianceThreshold, f_classif
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    fbeta_score,
    f1_score,
    make_scorer,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split
from sklearn.naive_bayes import GaussianNB
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier

SEED = 42
CAT_COLS = ["protocol_type", "service", "flag"]
KDD_FEATURES = [
    "duration", "protocol_type", "service", "flag", "src_bytes", "dst_bytes",
    "land", "wrong_fragment", "urgent", "hot", "num_failed_logins", "logged_in",
    "num_compromised", "root_shell", "su_attempted", "num_root",
    "num_file_creations", "num_shells", "num_access_files", "num_outbound_cmds",
    "is_host_login", "is_guest_login", "count", "srv_count", "serror_rate",
    "srv_serror_rate", "rerror_rate", "srv_rerror_rate", "same_srv_rate",
    "diff_srv_rate", "srv_diff_host_rate", "dst_host_count", "dst_host_srv_count",
    "dst_host_same_srv_rate", "dst_host_diff_srv_rate",
    "dst_host_same_src_port_rate", "dst_host_srv_diff_host_rate",
    "dst_host_serror_rate", "dst_host_srv_serror_rate", "dst_host_rerror_rate",
    "dst_host_srv_rerror_rate",
]
KDD_COLUMNS = KDD_FEATURES + ["attack", "difficulty"]
NUM_COLS = [c for c in KDD_FEATURES if c not in CAT_COLS]
LABEL_ALIASES = ("attack", "class", "label", "target")

# Dataset names in metrics.csv. "paper-like holdout" is kept from the previous
# study version so web/ml-service and the frontend keep recognising the
# stratified 80/20 holdout rows without filter changes.
HOLDOUT_DATASET = "paper-like holdout"
EXTERNAL_DATASET = "official KDDTest+ external"
FAMILY = "ids_results model"

SCORING = {
    "accuracy": "accuracy",
    "precision": "precision",
    "recall": "recall",
    "f1": "f1",
    "f2": make_scorer(fbeta_score, beta=2),
    "roc_auc": "roc_auc",
}

# The three classifiers from ids_results.py (make_models). Keep parameters
# exactly as specified there; clone() before every fit.
BASE_MODELS = {
    "Decision Tree": DecisionTreeClassifier(random_state=SEED),
    "Naive Bayes": GaussianNB(),
    "SVM (RBF)": SVC(kernel="rbf", C=1.0),
}


# ---------------------------------------------------------------------------
# Scoring / metric helpers (kept compatible with the previous study version)
# ---------------------------------------------------------------------------

def _positive_scores(estimator, X) -> np.ndarray:
    """Return a continuous anomaly score, preferring probabilities."""
    if hasattr(estimator, "predict_proba"):
        p = np.asarray(estimator.predict_proba(X))
        classes = getattr(estimator, "classes_", None)
        if classes is not None and 1 in classes:
            return p[:, list(classes).index(1)]
        return p[:, -1]
    if hasattr(estimator, "decision_function"):
        score = np.asarray(estimator.decision_function(X))
        if score.ndim == 2:
            return score[:, -1]
        return score
    return np.asarray(estimator.predict(X), dtype=float)


def _default_threshold(estimator) -> tuple[float, str]:
    """Use a classifier's customary operating point for its score type."""
    if hasattr(estimator, "predict_proba"):
        return 0.5, "probability threshold 0.5"
    if hasattr(estimator, "decision_function"):
        return 0.0, "decision-function boundary 0.0"
    return 0.5, "label/score threshold 0.5"


def _score_type(estimator) -> str:
    if hasattr(estimator, "predict_proba"):
        return "probability"
    if hasattr(estimator, "decision_function"):
        return "decision_function"
    return "label"


def _metric_row(y_true, scores, threshold: float) -> dict[str, float | int]:
    y_true = np.asarray(y_true, dtype=int)
    scores = np.asarray(scores, dtype=float)
    pred = (scores >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, pred, labels=[0, 1]).ravel()
    try:
        roc = float(roc_auc_score(y_true, scores))
    except ValueError:
        roc = float("nan")
    return {
        "threshold": float(threshold),
        "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp),
        "accuracy": float(accuracy_score(y_true, pred)),
        "precision": float(precision_score(y_true, pred, zero_division=0)),
        "recall": float(recall_score(y_true, pred, zero_division=0)),
        "f1": float(f1_score(y_true, pred, zero_division=0)),
        "f2": float(fbeta_score(y_true, pred, beta=2, zero_division=0)),
        "roc_auc": roc,
    }


# ---------------------------------------------------------------------------
# Data loading: Kaggle CSV (labeled or unlabeled) and NSL-KDD txt
# ---------------------------------------------------------------------------

def _to_binary(label: pd.Series) -> np.ndarray:
    labels = label.astype(str).str.strip().str.lower().str.rstrip(".")
    if set(labels.unique()).issubset({"0", "1", "0.0", "1.0"}):
        return labels.astype(float).astype(int).to_numpy()
    # "normal" -> 0; "anomaly" and every NSL-KDD attack name -> 1.
    return (labels != "normal").astype(int).to_numpy()


def _clean_features(df: pd.DataFrame, path: Path) -> pd.DataFrame:
    df.columns = [str(c).strip().lower() for c in df.columns]
    missing = [c for c in KDD_FEATURES if c not in df.columns]
    if missing:
        raise ValueError(
            f"{path} is missing {len(missing)} of the 41 NSL-KDD predictors: {missing}"
        )
    X = df[KDD_FEATURES].copy()
    for c in CAT_COLS:
        X[c] = X[c].astype(str).str.strip().str.lower().replace(
            {"nan": "__missing__", "none": "__missing__", "": "__missing__"}
        )
    for c in NUM_COLS:
        X[c] = pd.to_numeric(X[c], errors="coerce")
    return X.reset_index(drop=True)


def _read_dataset(path: Path) -> tuple[pd.DataFrame, np.ndarray | None]:
    """Load a Kaggle CSV or NSL-KDD txt file.

    Returns ``(X, y)`` where ``y`` is None for an unlabeled file such as
    Kaggle's Test_data.csv (41 feature columns and no label column).
    """
    raw = pd.read_csv(path, header=None, low_memory=False)
    first = str(raw.iloc[0, 0]).strip().lower() if len(raw) else ""

    if first in {"duration", "protocol_type"}:  # header row present (CSV files)
        df = pd.read_csv(path, header=0, low_memory=False)
        normalized = {str(c).strip().lower(): c for c in df.columns}
        label_key = next((k for k in LABEL_ALIASES if k in normalized), None)
        y = _to_binary(df[normalized[label_key]]) if label_key else None
        return _clean_features(df, path), y

    # No header: standard NSL-KDD positional layouts.
    if raw.shape[1] == 43:
        raw.columns = KDD_COLUMNS
    elif raw.shape[1] == 42:
        raw.columns = KDD_FEATURES + ["attack"]
    elif raw.shape[1] == 41:
        raw.columns = KDD_FEATURES
        return _clean_features(raw, path), None
    else:
        raise ValueError(f"Expected 41, 42 or 43 columns in {path}; got {raw.shape[1]}")
    return _clean_features(raw, path), _to_binary(raw["attack"])


# ---------------------------------------------------------------------------
# Pipelines: one-hot -> drop constants -> scale -> [top-k] -> classifier
# (Only built-in scikit-learn objects are used, so the saved joblib pipeline
# loads in app.py / web/ml-service without importing this module.)
# ---------------------------------------------------------------------------

def _make_preprocessor() -> ColumnTransformer:
    # One transformer per raw column, in canonical KDD_FEATURES order, so the
    # encoded matrix has the same column order as ids_results.py's
    # pd.get_dummies output (column order affects Decision Tree tie-breaking;
    # SVM/NB results are order-invariant).
    transformers: list[tuple[str, Any, list[str]]] = []
    for col in KDD_FEATURES:
        if col in CAT_COLS:
            step: Any = Pipeline(
                [
                    ("imputer", SimpleImputer(strategy="most_frequent")),
                    ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
                ]
            )
        else:
            step = SimpleImputer(strategy="median")
        transformers.append((col, step, [col]))
    return ColumnTransformer(transformers, remainder="drop", sparse_threshold=0.0)


def _make_pipeline(model_name: str, top_k: int | None) -> Pipeline:
    steps: list[tuple[str, Any]] = [
        ("prep", _make_preprocessor()),
        ("variance", VarianceThreshold(threshold=0.0)),
        ("scale", StandardScaler()),
    ]
    if top_k is not None:
        steps.append(("select", SelectKBest(score_func=f_classif, k=top_k)))
    steps.append(("clf", clone(BASE_MODELS[model_name])))
    return Pipeline(steps)


def _encoded_feature_names(pipeline: Pipeline) -> tuple[list[str], list[str]]:
    """Return (kept encoded feature names, selected names after top-k step)."""
    names = [str(n) for n in pipeline.named_steps["prep"].get_feature_names_out()]
    kept = pipeline.named_steps["variance"].get_support()
    kept_names = [n for n, keep in zip(names, kept) if keep]
    if "select" in pipeline.named_steps:
        selected = pipeline.named_steps["select"].get_support()
        return kept_names, [n for n, keep in zip(kept_names, selected) if keep]
    return kept_names, kept_names


# ---------------------------------------------------------------------------
# Figures (same output filenames as the previous study version)
# ---------------------------------------------------------------------------

def _write_roc_plot(candidate_scores, datasets, out_path: Path) -> None:
    fig, axes = plt.subplots(1, len(datasets), figsize=(7 * len(datasets), 5), squeeze=False)
    palette = plt.get_cmap("tab10")
    for ax, (dataset_name, (_, y_eval)) in zip(axes[0], datasets.items()):
        for i, (label, per_dataset) in enumerate(candidate_scores.items()):
            if dataset_name not in per_dataset:
                continue
            score = per_dataset[dataset_name]
            fpr, tpr, _ = roc_curve(y_eval, score)
            ax.plot(fpr, tpr, lw=1.6, color=palette(i % 10),
                    label=f"{label} (AUC {roc_auc_score(y_eval, score):.3f})")
        ax.plot([0, 1], [0, 1], "k--", lw=1)
        ax.set_title(f"ROC — {dataset_name}")
        ax.set_xlabel("False positive rate")
        ax.set_ylabel("True positive rate")
        ax.grid(alpha=0.25)
        ax.legend(fontsize=7, loc="lower right")
    fig.tight_layout()
    fig.savefig(out_path, dpi=180, bbox_inches="tight")
    plt.close(fig)


def _write_confusion_plot(rows: list[dict[str, Any]], out_path: Path) -> None:
    frame = pd.DataFrame(rows)
    frame = frame[(frame["dataset"] == HOLDOUT_DATASET) & (frame["threshold_mode"] == "default")]
    if frame.empty:
        return
    n = len(frame)
    cols = min(3, n)
    fig, axes = plt.subplots(math.ceil(n / cols), cols,
                             figsize=(4 * cols, 3.8 * math.ceil(n / cols)), squeeze=False)
    for ax, (_, row) in zip(axes.flat, frame.iterrows()):
        mat = np.array([[row["tn"], row["fp"]], [row["fn"], row["tp"]]])
        ax.imshow(mat, cmap="Blues")
        ax.set_xticks([0, 1], labels=["Normal", "Anomaly"])
        ax.set_yticks([0, 1], labels=["Normal", "Anomaly"])
        ax.set_xlabel("Predicted")
        ax.set_ylabel("Actual")
        ax.set_title(f"{row['model']}\n({row['feature_set']})", fontsize=9)
        for (i, j), v in np.ndenumerate(mat):
            ax.text(j, i, f"{int(v):,}", ha="center", va="center", color="black")
    for ax in axes.flat[n:]:
        ax.axis("off")
    fig.tight_layout()
    fig.savefig(out_path, dpi=180, bbox_inches="tight")
    plt.close(fig)


def _permutation_importance(estimator, X_eval, y_eval) -> dict[str, float]:
    n = min(len(X_eval), 2500)
    perm = permutation_importance(
        estimator, X_eval.iloc[:n].copy(), np.asarray(y_eval)[:n],
        n_repeats=3, random_state=SEED, scoring="f1", n_jobs=-1,
    )
    series = pd.Series(perm.importances_mean, index=KDD_FEATURES).sort_values(ascending=False)
    return {str(k): float(v) for k, v in series.items()}


def _write_importance_plot(importance: dict[str, float], out_path: Path, top_n: int = 18) -> None:
    values = pd.Series(importance).head(top_n)
    fig, ax = plt.subplots(figsize=(9, 6))
    values.sort_values().plot(kind="barh", ax=ax, color="#286f8e")
    ax.set_xlabel("Mean decrease in F1 after permutation")
    ax.set_title("Permutation importance (raw input features)")
    ax.grid(axis="x", alpha=0.25)
    fig.tight_layout()
    fig.savefig(out_path, dpi=180, bbox_inches="tight")
    plt.close(fig)


# ---------------------------------------------------------------------------
# Small utilities
# ---------------------------------------------------------------------------

def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _json_value(value):
    """Convert pandas/numpy scalars to JSON-safe Python values."""
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def _find_default(candidates: list[str]) -> Path | None:
    script_dir = Path(__file__).resolve().parent
    for rel in candidates:
        for base in (Path.cwd(), script_dir):
            p = base / rel
            if p.exists():
                return p
    return None


def _external_label(path: Path) -> str:
    return EXTERNAL_DATASET if "kddtest" in path.name.lower() else f"external test ({path.name})"


# ---------------------------------------------------------------------------
# Main experiment
# ---------------------------------------------------------------------------

def run(args) -> None:
    if args.synthetic:
        raise SystemExit(
            "--synthetic was removed when the models were replaced with "
            "ids_results.py. Run with real data, e.g. --train Train_data.csv "
            "--test Test_data.csv (or the NSL-KDD files in data/)."
        )
    for deprecated in ("n_iter", "target_recall"):
        if getattr(args, deprecated) is not None:
            flag = "--" + deprecated.replace("_", "-")
            print(f"warning: {flag} is accepted for backward compatibility but ignored "
                  "(ids_results.py models use fixed parameters and default thresholds).",
                  file=sys.stderr)

    train_path = Path(args.train) if args.train else _find_default(
        ["Train_data.csv", "data/KDDTrain+_20Percent.txt", "data/KDDTrain+.txt"]
    )
    if train_path is None or not train_path.exists():
        raise SystemExit(
            "No training file found. Pass --train Train_data.csv (or an "
            "NSL-KDD KDDTrain+ file). Searched next to this script and the "
            "current folder by default."
        )
    test_path = Path(args.test) if args.test else _find_default(
        ["Test_data.csv", "data/KDDTest+.txt"]
    )
    if test_path is not None and not test_path.exists():
        raise SystemExit(f"--test file not found: {test_path}")
    external_path = Path(args.external_test) if args.external_test else None
    if external_path is not None and not external_path.exists():
        raise SystemExit(f"--external-test file not found: {external_path}")

    out_dir = Path(args.out)
    fig_dir = out_dir / "figures"
    out_dir.mkdir(parents=True, exist_ok=True)
    if not args.no_figures:
        fig_dir.mkdir(parents=True, exist_ok=True)

    # ---------------- Load ----------------
    X, y = _read_dataset(train_path)
    if y is None:
        raise SystemExit(f"Training file has no label column: {train_path}")
    X_unlabeled: pd.DataFrame | None = None
    external: tuple[str, pd.DataFrame, np.ndarray, Path] | None = None
    input_files: dict[str, Any] = {
        "train": {"file": train_path.name, "sha256": _sha256(train_path),
                  "rows": int(len(X)), "normal": int((y == 0).sum()),
                  "anomaly": int((y == 1).sum())},
    }
    if test_path is not None:
        X_test_file, y_test_file = _read_dataset(test_path)
        if y_test_file is None:
            X_unlabeled = X_test_file
            input_files["test_unlabeled"] = {
                "file": test_path.name, "sha256": _sha256(test_path), "rows": int(len(X_test_file)),
            }
        else:
            if external is None and external_path is None:
                external = (_external_label(test_path), X_test_file, y_test_file, test_path)
    if external_path is not None:
        X_ext, y_ext = _read_dataset(external_path)
        if y_ext is None:
            raise SystemExit(f"--external-test must be labeled: {external_path}")
        external = (_external_label(external_path), X_ext, y_ext, external_path)
    if external is not None:
        _, _, y_ext_all, ext_path = external
        input_files["external_test"] = {
            "file": ext_path.name, "sha256": _sha256(ext_path),
            "rows": int(len(y_ext_all)), "normal": int((y_ext_all == 0).sum()),
            "anomaly": int((y_ext_all == 1).sum()),
        }

    print(f"Train rows: {len(X)} (normal {(y == 0).sum():,}, anomaly {(y == 1).sum():,}) "
          f"| raw features: {X.shape[1]} | file: {train_path.name}")
    if X_unlabeled is not None:
        print(f"Unlabeled test rows: {len(X_unlabeled):,} | file: {test_path.name}")
    if external is not None:
        print(f"External labeled rows: {len(external[2]):,} | file: {external[3].name}")

    # ---------------- Holdout split (ids_results.py: 80/20 stratified) ----------------
    X_fit, X_hold, y_fit, y_hold = train_test_split(
        X, y, test_size=args.test_size, random_state=SEED, stratify=y
    )
    cv = StratifiedKFold(n_splits=args.cv, shuffle=True, random_state=SEED)
    feature_sets: dict[str, int | None] = {
        "All features": None,
        f"Top-{args.top_k} correlated features": args.top_k,
    }

    metric_rows: list[dict[str, Any]] = []
    cv_rows: list[dict[str, Any]] = []
    fitted: dict[tuple[str, str], Pipeline] = {}
    scores: dict[str, dict[str, np.ndarray]] = {}  # display label -> dataset -> scores
    eval_datasets: dict[str, tuple[pd.DataFrame, np.ndarray]] = {HOLDOUT_DATASET: (X_hold, y_hold)}
    if external is not None:
        eval_datasets[external[0]] = (external[1], external[2])

    for feature_set, top_k in feature_sets.items():
        for model_name in BASE_MODELS:
            label = f"{model_name} [{feature_set}]"
            print(f"\n--- {label} ---")
            pipeline = _make_pipeline(model_name, top_k)

            start = time.perf_counter()
            cv_result = cross_validate(pipeline, X_fit, y_fit, cv=cv, scoring=SCORING, n_jobs=-1)
            cv_seconds = time.perf_counter() - start
            cv_summary: dict[str, float] = {}
            for metric in SCORING:
                values = np.asarray(cv_result[f"test_{metric}"], dtype=float)
                cv_summary[f"cv_{metric}_mean"] = float(np.nanmean(values))
                cv_summary[f"cv_{metric}_std"] = float(np.nanstd(values))
            cv_rows.append({"model": model_name, "feature_set": feature_set, **cv_summary})
            print(f"  CV{args.cv} on fit subset: acc {cv_summary['cv_accuracy_mean']:.4f} "
                  f"| F1 {cv_summary['cv_f1_mean']:.4f} ({cv_seconds:.0f}s)")

            start = time.perf_counter()
            pipeline.fit(X_fit, y_fit)
            fit_seconds = time.perf_counter() - start
            fitted[(model_name, feature_set)] = pipeline
            threshold, threshold_note = _default_threshold(pipeline)
            scores[label] = {}

            for position, (dataset_name, (X_eval, y_eval)) in enumerate(eval_datasets.items()):
                start = time.perf_counter()
                eval_scores = _positive_scores(pipeline, X_eval)
                inference_seconds = time.perf_counter() - start
                scores[label][dataset_name] = eval_scores
                row = {
                    "dataset": dataset_name,
                    "model": model_name,
                    "family": FAMILY,
                    "feature_set": feature_set,
                    "threshold_mode": "default",
                    "threshold_note": threshold_note,
                    **_metric_row(y_eval, eval_scores, threshold),
                    "fit_seconds": float(fit_seconds),
                    # Inference time is reported for the first (holdout) dataset,
                    # as in the previous study version's metrics.csv.
                    "inference_seconds": float(inference_seconds) if position == 0 else float("nan"),
                    "cv_seconds": float(cv_seconds),
                    **cv_summary,
                }
                metric_rows.append(row)
                print(f"  {dataset_name}: acc {row['accuracy']:.4f} | prec {row['precision']:.4f} "
                      f"| rec {row['recall']:.4f} | F1 {row['f1']:.4f} "
                      f"| TN/FP/FN/TP {row['tn']}/{row['fp']}/{row['fn']}/{row['tp']}")

    result_frame = pd.DataFrame(metric_rows)
    cv_frame = pd.DataFrame(cv_rows).sort_values(
        ["cv_f1_mean", "cv_accuracy_mean"], ascending=False
    ).reset_index(drop=True)
    result_frame.to_csv(out_dir / "metrics.csv", index=False)
    cv_frame.to_csv(out_dir / "cross_validation.csv", index=False)

    # ---------------- Select best candidate by CV F1 ----------------
    best = cv_frame.iloc[0]
    best_name, best_feature_set = str(best["model"]), str(best["feature_set"])
    best_by_f2 = cv_frame.sort_values("cv_f2_mean", ascending=False).iloc[0]
    print(f"\nSelected by CV F1: {best_name} [{best_feature_set}] "
          f"(CV F1 {best['cv_f1_mean']:.4f} ± {best['cv_f1_std']:.4f}, "
          f"CV acc {best['cv_accuracy_mean']:.4f})")

    if not args.no_figures:
        _write_roc_plot(scores, eval_datasets, fig_dir / "roc_curves.png")
        _write_confusion_plot(metric_rows, fig_dir / "confusion_matrices_holdout.png")

    # Permutation importance of the selected fit-subset model, on the holdout.
    importance = _permutation_importance(fitted[(best_name, best_feature_set)], X_hold, y_hold)
    if not args.no_figures:
        _write_importance_plot(importance, fig_dir / "permutation_importance.png")

    # ---------------- Final refits on ALL labeled data ----------------
    final_all_features: dict[str, Pipeline] = {}
    test_prediction_rates: dict[str, float] = {}
    for model_name in BASE_MODELS:
        final = _make_pipeline(model_name, None)
        final.fit(X, y)
        final_all_features[model_name] = final
        if X_unlabeled is not None:
            pred = final.predict(X_unlabeled)
            test_prediction_rates[model_name] = float(np.mean(pred))

    if feature_sets[best_feature_set] is None:
        artifact_model = final_all_features[best_name]
    else:
        artifact_model = _make_pipeline(best_name, feature_sets[best_feature_set])
        artifact_model.fit(X, y)

    artifact_path = out_dir / "ids_model.joblib"
    joblib.dump(artifact_model, artifact_path)
    threshold, threshold_note = _default_threshold(artifact_model)
    kept_names, selected_names = _encoded_feature_names(artifact_model)

    if X_unlabeled is not None:
        artifact_scores = _positive_scores(artifact_model, X_unlabeled)
        artifact_pred = (artifact_scores >= threshold).astype(int)
        pd.DataFrame(
            {
                "row": np.arange(len(X_unlabeled)),
                "anomaly_score": artifact_scores,
                "prediction": np.where(artifact_pred == 1, "anomaly", "normal"),
            }
        ).to_csv(out_dir / "test_predictions.csv", index=False)
        print("\n=== Predictions on unlabeled test file "
              "(all-features models refit on all labeled data) ===")
        for model_name, rate in test_prediction_rates.items():
            print(f"{model_name}: {rate * 100:.1f}% of {len(X_unlabeled):,} rows "
                  "predicted as anomaly")
        print(f"Saved artifact ({best_name} [{best_feature_set}]): "
              f"{np.mean(artifact_pred) * 100:.1f}% predicted as anomaly "
              "-> test_predictions.csv")

    # ---------------- Metadata for app.py / web/ml-service ----------------
    categorical_options = {
        c: sorted(str(v) for v in X[c].dropna().unique()) for c in CAT_COLS
    }

    def _example(target: int) -> dict[str, Any]:
        idx = int(np.flatnonzero(y == target)[0])
        return {c: _json_value(X.iloc[idx][c]) for c in KDD_FEATURES}

    prediction_metadata = {
        "model_name": best_name,
        "artifact": artifact_path.name,
        "threshold": float(threshold),
        "threshold_note": threshold_note,
        "score_type": _score_type(artifact_model),
        "positive_class": "anomaly",
        "feature_set": best_feature_set,
        "feature_columns": KDD_FEATURES,
        "categorical_columns": CAT_COLS,
        "numeric_columns": NUM_COLS,
        "categorical_options": categorical_options,
        "demo_samples": {"normal": _example(0), "anomaly": _example(1)},
    }
    (out_dir / "model_metadata.json").write_text(
        json.dumps(prediction_metadata, indent=2, default=str)
    )

    holdout_best = result_frame[
        (result_frame["dataset"] == HOLDOUT_DATASET)
        & (result_frame["model"] == best_name)
        & (result_frame["feature_set"] == best_feature_set)
    ].iloc[0]
    metadata = {
        "seed": SEED,
        "models": list(BASE_MODELS),
        "model_source": "ids_results.py (Decision Tree, Gaussian Naive Bayes, SVM-RBF)",
        "feature_sets": list(feature_sets),
        "top_k": args.top_k,
        "top_k_method": ("SelectKBest(f_classif) inside the pipeline; for a binary label "
                         "this ranks encoded features equivalently to |Pearson r|"),
        "source": train_path.name,
        "external_test": external[3].name if external else None,
        "input_files": input_files,
        "train_rows": int(len(X)),
        "train_normal": int((y == 0).sum()),
        "train_anomaly": int((y == 1).sum()),
        "fit_rows": int(len(X_fit)),
        "holdout_rows": int(len(X_hold)),
        "holdout_normal": int((y_hold == 0).sum()),
        "holdout_anomaly": int((y_hold == 1).sum()),
        "external_rows": int(len(external[2])) if external else None,
        "external_normal": int((external[2] == 0).sum()) if external else None,
        "external_anomaly": int((external[2] == 1).sum()) if external else None,
        "unlabeled_test_rows": int(len(X_unlabeled)) if X_unlabeled is not None else None,
        "unlabeled_test_anomaly_rates": test_prediction_rates or None,
        "features": int(X.shape[1]),
        "encoded_features_after_variance_filter": len(kept_names),
        "selected_encoded_features": selected_names if feature_sets[best_feature_set] else None,
        "cv_folds": args.cv,
        "cv_scope": "fit subset only (holdout and external test excluded)",
        "selection_metric": "cv_f1_mean",
        "selected_model": best_name,
        "selected_feature_set": best_feature_set,
        "best_model_by_cv_f1": best_name,
        "best_model_by_cv_f2": str(best_by_f2["model"]),
        "selected_holdout_accuracy": float(holdout_best["accuracy"]),
        "selected_holdout_f1": float(holdout_best["f1"]),
        "saved_model_artifact": artifact_path.name,
        "prediction_metadata": "model_metadata.json",
        "best_model_threshold": float(threshold),
        "best_model_threshold_note": threshold_note,
        "best_model_permutation_importance": importance,
        "software": {
            "python": platform.python_version(),
            "scikit-learn": sklearn.__version__,
            "pandas": pd.__version__,
            "numpy": np.__version__,
        },
    }
    (out_dir / "run_metadata.json").write_text(json.dumps(metadata, indent=2, default=str))

    # ---------------- Console summary (ids_results.py-style tables) ----------------
    print("\nOperational metrics on the holdout (anomaly = positive):")
    for feature_set in feature_sets:
        rows = []
        for model_name in BASE_MODELS:
            r = result_frame[
                (result_frame["dataset"] == HOLDOUT_DATASET)
                & (result_frame["model"] == model_name)
                & (result_frame["feature_set"] == feature_set)
            ].iloc[0]
            rows.append({
                "Model": model_name, "Acc": r["accuracy"], "Prec": r["precision"],
                "Rec": r["recall"], "F1": r["f1"], "CV Acc": r["cv_accuracy_mean"],
                "TN": int(r["tn"]), "FP": int(r["fp"]), "FN": int(r["fn"]), "TP": int(r["tp"]),
            })
        print(f"\n=== {feature_set} ===")
        print(pd.DataFrame(rows).set_index("Model").round(4).to_string())
    print("\nTN/FP/FN/TP = true normal, false alarm, missed attack, caught attack")
    print(f"\nWrote: {out_dir / 'metrics.csv'}; {out_dir / 'cross_validation.csv'}; "
          f"{artifact_path}; model_metadata.json; figures/; run_metadata.json"
          + ("; test_predictions.csv" if X_unlabeled is not None else ""))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--train", default=None,
                        help="Labeled Train_data.csv or KDDTrain+ txt "
                             "(default: auto-detect in project folder)")
    parser.add_argument("--test", default=None,
                        help="Test_data.csv (unlabeled, predictions only) or a labeled "
                             "test file such as KDDTest+.txt (default: auto-detect)")
    parser.add_argument("--external-test", default=None,
                        help="Extra labeled test file, e.g. data/KDDTest+.txt when "
                             "--test is the unlabeled Test_data.csv")
    parser.add_argument("--out", default="results", help="Output folder")
    parser.add_argument("--cv", type=int, default=5, help="Stratified CV folds (default 5)")
    parser.add_argument("--top-k", type=int, default=30,
                        help="Features kept in the correlated-features run (default 30)")
    parser.add_argument("--test-size", type=float, default=0.2,
                        help="Holdout fraction of the labeled train file (default 0.2)")
    parser.add_argument("--no-figures", action="store_true", help="Skip writing figures/")
    # Deprecated flags from the previous 14-model version (accepted, ignored).
    parser.add_argument("--n-iter", type=int, default=None,
                        help="Deprecated: hyperparameter search was removed; ignored")
    parser.add_argument("--target-recall", type=float, default=None,
                        help="Deprecated: threshold calibration was removed; ignored")
    parser.add_argument("--synthetic", action="store_true",
                        help="Removed: synthetic fallback no longer supported")
    parser.add_argument("--synthetic-rows", type=int, default=None,
                        help="Removed with --synthetic; ignored")
    args = parser.parse_args()
    if args.cv < 2:
        parser.error("--cv must be at least 2")
    if args.top_k < 1:
        parser.error("--top-k must be at least 1")
    if not (0 < args.test_size < 1):
        parser.error("--test-size must be in (0, 1)")
    run(args)


if __name__ == "__main__":
    main()
