# Network Intrusion Detection — Decision Tree vs Naive Bayes vs SVM

**Positive class:** Anomaly / attack (`1`) · **Seed:** 42 · **Main implementation:** [`cybersecurity_ids_study.py`](cybersecurity_ids_study.py) · **Model source:** [`ids_results.py`](ids_results.py)

## Summary

The models in this codebase were replaced with exactly the three models from
`ids_results.py`:

| Model | Classifier (scikit-learn) |
|---|---|
| Decision Tree | `DecisionTreeClassifier(random_state=42)` |
| Naive Bayes | `GaussianNB()` |
| SVM (RBF) | `SVC(kernel="rbf", C=1.0)` |

Each model is evaluated twice — with **all encoded features** and with only the
**top-30 features most correlated with the label** — exactly as in
`ids_results.py`. The previous 14-model comparison (Logistic Regression, KNN,
Linear SVM, Random Forest, Gradient Boosting, HistGradientBoosting, MLP,
XGBoost, LightGBM, soft-voting and stacking ensembles, plus paper-style
baselines, hyperparameter search and recall-target threshold calibration) has
been **removed**. Its `results/` artifacts (LightGBM model, metrics, figures)
were superseded by the retrained artifacts described below; recover the old
versions from Drive file version history / trash if ever needed.

**Selected deployed model:** Decision Tree with all features (highest
cross-validated F1), refit on all 25,192 labeled rows and saved as
`results/ids_model.joblib` (threshold 0.5 on predicted probability). It is the
model loaded by `app.py` and by `web/ml-service`.

Headline results (details in [Results](#3-results)): on the stratified 80/20
holdout the Decision Tree reaches 99.72% accuracy / 99.70% F1, SVM (RBF)
98.95% / 98.87%, and Naive Bayes collapses with all features (39.04% recall)
but recovers to 94.30% / 93.96% with the top-30 feature set. On the official
KDDTest+ external set — the labeled twin of `Test_data.csv` — every model
drops sharply (best accuracy 80.02%, Naive Bayes top-30), so the holdout
scores must not be interpreted as novel-attack detection rates.

## 1. Data

Both supported datasets contain the same 41 NSL-KDD connection features
(`protocol_type`, `service`, `flag` categorical; the other 38 numeric):

| File | Rows | Labels |
|---|---:|---|
| `Train_data.csv` (Kaggle CSV, header) | 25,192 | `class`: 13,449 normal / 11,743 anomaly |
| `data/KDDTrain+_20Percent.txt` (NSL-KDD, no header) | 25,192 | attack names; same records in binary form above |
| `Test_data.csv` (Kaggle CSV, header) | 22,544 | none — predictions only |
| `data/KDDTest+.txt` (NSL-KDD, no header) | 22,544 | 9,711 normal / 12,833 attacks |

`Test_data.csv` is verified feature-for-feature identical to `KDDTest+.txt`
with the labels removed, so the canonical run below uses `Test_data.csv` for
predictions **and** `KDDTest+.txt` as a labeled external test of the same
traffic. The NSL-KDD `difficulty` field is always excluded from the features.
Labels are mapped `normal -> 0`, anything else (`anomaly` or an attack name)
`-> 1`.

SHA-256 of the files used for the delivered run (also in
`results/run_metadata.json`):

| File | SHA-256 |
|---|---|
| `Train_data.csv` | `1e40eb667611ab507870fc5b5ef0a844201ec094915d78d79f4665937e43b07a` |
| `Test_data.csv` | `a58db8c605e58411f6432dd9ab2fe10e1d768f058f5453e9e279788c7219caf8` |
| `data/KDDTest+.txt` | `fa46b0935342616aa83b7c2578db355b6a7aaabbc492248172c7a1e8b7ab8f84` |
| `data/KDDTrain+_20Percent.txt` | `7ea86479faab5ca2190b7f18b4982fb058ce5bf2b46e0e1017d0d9ef90f9c16e` |

Note: `cybersecurity_intrusion_data.csv` in this folder is a different
(session-level) dataset with a different schema; neither the old nor the new
training script uses it, and it is left untouched.

## 2. Methodology

- **Split:** one stratified 80/20 split of the labeled train file
  (`random_state=42`): 20,153 fit rows and a 5,039-row holdout (2,690 normal /
  2,349 attacks). In `metrics.csv` the holdout keeps its previous dataset
  label `paper-like holdout` so the web dashboard filters keep working.
- **Cross-validation:** 5-fold stratified CV (as in `ids_results.py`) computed
  on the fit subset only. The deployed candidate is selected by CV F1, so
  model selection never uses the holdout or the external test.
- **Preprocessing (deployment-safe equivalent of `ids_results.py`):**
  median imputation for numerics; one-hot encoding of
  `protocol_type`/`service`/`flag` fitted on training data only with unknown
  categories ignored; constant-column removal (`VarianceThreshold`);
  `StandardScaler` over all encoded features; then the classifier. Encoded
  width after the variance filter: 116 features. Because the whole pipeline
  uses only built-in scikit-learn objects, `ids_model.joblib` loads directly
  in `app.py` and `web/ml-service` and accepts the raw 41-field records they
  send. (`ids_results.py` instead fits `pd.get_dummies` on train+test
  concatenated, which cannot be saved for single-record inference.)
- **Top-30 feature selection:** `SelectKBest(f_classif, k=30)` inside the
  pipeline. For a binary label on complete data, ANOVA-F ranking is
  monotonically equivalent to the |Pearson r(feature, y)| ranking used by
  `ids_results.py`, and keeping the selector inside the pipeline refits it in
  every CV fold (no target leakage).
- **Operating point:** each classifier's default — probability threshold 0.5
  (Decision Tree, Naive Bayes) and decision boundary 0.0 (SVM) — matching
  `predict` in `ids_results.py`. There is no threshold calibration or
  hyperparameter search any more; `--n-iter` and `--target-recall` are still
  accepted (with a warning) for backward compatibility, and `--synthetic` was
  removed (`results-synthetic/` is now a historical artifact only).
- **Final artifact:** the CV-F1 winner refit on 100% of labeled rows.
  All-features variants of all three models are also refit on 100% of labeled
  rows to reproduce `ids_results.py`'s unlabeled-test predictions.
- **Software:** Python 3.13.16, scikit-learn 1.6.1, pandas 2.2.3,
  NumPy 2.3.5 (see `results/run_metadata.json`). A full run takes ~40 s.

### Agreement with standalone `ids_results.py`

Running the original `ids_results.py` on the same files gives holdout
accuracy/precision/recall/F1 for Naive Bayes and SVM identical to this
pipeline at 4 decimal places in both feature sets (their results are
invariant to encoded-column order). The Decision Tree differs by at most a
few holdout rows (99.72% here vs 99.68% standalone accuracy; 41.4% vs 41.7%
predicted-anomaly rate on `Test_data.csv`) because trees break split ties
according to column order and this pipeline's encoder is fitted on training
rows only (116 vs 118 encoded columns — two test-only service values become
unknown-category-ignored instead of extra all-zero training columns). CV
means also differ slightly by design: standalone CV uses all 25,192 rows,
here CV uses the 20,153-row fit subset.

## 3. Results

### 3.1 Stratified holdout (5,039 rows; anomaly = positive)

**All features**

| Model | Accuracy % | Precision % | Recall % | F1 % | ROC-AUC % | TN/FP/FN/TP |
|---|---:|---:|---:|---:|---:|---:|
| **Decision Tree (deployed)** | **99.72** | 99.74 | **99.66** | **99.70** | 99.72 | 2684/6/8/2341 |
| Naive Bayes | 71.46 | 99.35 | 39.04 | 56.05 | 98.04 | 2684/6/1432/917 |
| SVM (RBF) | 98.95 | 98.69 | 99.06 | 98.87 | 99.81 | 2659/31/22/2327 |

**Top-30 correlated features**

| Model | Accuracy % | Precision % | Recall % | F1 % | ROC-AUC % | TN/FP/FN/TP |
|---|---:|---:|---:|---:|---:|---:|
| Decision Tree | 98.95 | 98.81 | 98.94 | 98.87 | 98.99 | 2662/28/25/2324 |
| Naive Bayes | 94.30 | 92.96 | 94.98 | 93.96 | 97.87 | 2521/169/118/2231 |
| SVM (RBF) | 97.88 | 98.91 | 96.51 | 97.69 | 99.63 | 2665/25/82/2267 |

Gaussian Naive Bayes is the clear outlier: with all 116 encoded features its
independence assumption over many correlated one-hot columns produces
over-confident "normal" posteriors, missing 1,432 of 2,349 attacks even though
its ranking quality is still high (ROC-AUC 98.04% — the 0.5 threshold, not the
ordering, is what fails). Restricting it to the top-30 correlated features
restores 94.98% recall. Top-30 selection slightly *hurts* the Decision Tree
and SVM on this holdout.

### 3.2 Cross-validation (5-fold on the 20,153-row fit subset)

| Candidate | CV accuracy % | CV F1 % (mean ± SD) | CV ROC-AUC % |
|---|---:|---:|---:|
| **Decision Tree — All features (selected)** | 99.68 | **99.65 ± 0.10** | 99.67 |
| Decision Tree — Top-30 | 98.85 | 98.77 ± 0.15 | 98.88 |
| SVM (RBF) — All features | 98.69 | 98.59 ± 0.45 | 99.82 |
| SVM (RBF) — Top-30 | 97.91 | 97.73 ± 0.38 | 99.74 |
| Naive Bayes — Top-30 | 94.18 | 93.87 ± 0.58 | 97.69 |
| Naive Bayes — All features | 71.57 | 56.16 ± 1.96 | 98.14 |

Full per-metric means/SDs: `results/cross_validation.csv`.

Permutation importance of the deployed Decision Tree (mean decrease in holdout
F1, 2,500-row sample, 3 repeats; full 41-feature table in
`results/run_metadata.json`, chart in `results/figures/permutation_importance.png`):
`src_bytes` 0.192, `logged_in` 0.154, `dst_bytes` 0.129, `service` 0.101,
`dst_host_srv_serror_rate` 0.038. Decision-tree probabilities are leaf fractions
and are often exactly 0 or 1 — treat the demo's "score" as a model output, not
a calibrated risk estimate.

### 3.3 Official KDDTest+ external test (22,544 rows)

Models below are the fit-subset (80%) fits; this set was used for nothing but
final scoring. It contains attack categories absent from the training subset,
and every candidate degrades substantially:

| Model | Features | Accuracy % | Precision % | Recall % | F1 % | ROC-AUC % | TN/FP/FN/TP |
|---|---|---:|---:|---:|---:|---:|---:|
| Decision Tree | All | 79.01 | 92.11 | 69.03 | 78.92 | 80.61 | 8952/759/3974/8859 |
| Naive Bayes | All | 51.34 | 96.88 | 15.01 | 25.99 | 84.20 | 9649/62/10907/1926 |
| SVM (RBF) | All | 78.43 | 92.27 | 67.79 | 78.16 | 90.26 | 8982/729/4133/8700 |
| Decision Tree | Top-30 | 79.88 | 96.09 | 67.40 | 79.23 | 81.92 | 9359/352/4184/8649 |
| **Naive Bayes** | **Top-30** | **80.02** | 92.73 | **70.42** | **80.05** | **92.78** | 9002/709/3796/9037 |
| SVM (RBF) | Top-30 | 75.95 | 92.11 | 63.16 | 74.94 | 85.40 | 9017/694/4728/8105 |

Note the ranking flips externally: Naive Bayes with top-30 features
generalizes best here, while the holdout winner (Decision Tree, all features)
misses 3,974 of 12,833 attacks. This is the usual NSL-KDD random-split
optimism — high holdout scores reflect repeated attack patterns, not detection
of novel attacks. The deployed model is still chosen by pre-registered CV F1
(not by peeking at this test); if external-set performance matters most,
re-run selection on that criterion explicitly instead.

### 3.4 Predictions on unlabeled `Test_data.csv`

All-features models refit on all 25,192 labeled rows (no accuracy is possible
without labels). The deployed Decision Tree's per-row scores/labels are saved
in `results/test_predictions.csv` (9,341 anomaly / 13,203 normal).

| Model | Predicted anomaly |
|---|---:|
| Decision Tree (deployed) | 41.4% of 22,544 rows |
| Naive Bayes | 8.8% |
| SVM (RBF) | 41.8% |

For reference, the true anomaly rate of this same traffic in `KDDTest+.txt` is
56.9% (12,833/22,544) — all three models under-flag it, Naive Bayes severely.

## 4. Usage

```bash
python -m pip install -r requirements.txt

# Canonical run (Kaggle CSVs + labeled external twin), ~40 s:
python cybersecurity_ids_study.py --train Train_data.csv --test Test_data.csv \
    --external-test data/KDDTest+.txt --out results --cv 5

# NSL-KDD text files only:
python cybersecurity_ids_study.py --train data/KDDTrain+_20Percent.txt \
    --test data/KDDTest+.txt --out results --cv 5

# Streamlit demo (loads results/ids_model.joblib + model_metadata.json):
python -m pip install -r requirements-web.txt
streamlit run app.py
```

With no `--train`/`--test`, the script auto-detects in this order:
`Train_data.csv`, else `data/KDDTrain+_20Percent.txt` / `KDDTrain+.txt`; and
`Test_data.csv`, else `data/KDDTest+.txt`. A `--test` file with a label column
is treated as a labeled external test; without one it is used for predictions
only. `--top-k` (default 30) and `--test-size` (default 0.2) control the
feature-selection run and holdout fraction. The web app in `web/` serves the
same `results/` artifacts; its metrics API (`GET /models/metrics`,
`/models/comparison`, `/models/available`) now reports the 3 models × 2
feature sets (note: the comparison endpoint keeps its legacy field names —
`paper_baselines` = all-features rows, `improved_models` = top-30 rows,
`reference_rf_holdout` = deployed model's holdout row — see the endpoint's
`summary.field_mapping_note`).

## 5. Outputs (`results/`)

| File | Contents |
|---|---|
| `ids_model.joblib` | Deployed pipeline (Decision Tree, all features, refit on all labeled rows) |
| `model_metadata.json` | Model name, feature set, threshold, score type, 41-field schema, categorical options, demo rows (used by `app.py` / `web/ml-service`) |
| `metrics.csv` | 12 rows = 3 models × 2 feature sets × 2 datasets, with confusion counts, metrics, timings and CV summaries (same columns as before, plus `feature_set`) |
| `cross_validation.csv` | 5-fold CV mean ± SD per candidate, sorted by CV F1 |
| `run_metadata.json` | Inputs + SHA-256, splits, selection, test-prediction rates, permutation importance, software versions |
| `test_predictions.csv` | Deployed model's score + normal/anomaly prediction for each `Test_data.csv` row |
| `figures/roc_curves.png` | ROC curves (holdout and KDDTest+ panels, 6 candidates) |
| `figures/confusion_matrices_holdout.png` | Holdout confusion matrices (6 candidates) |
| `figures/permutation_importance.png` | Top-18 raw-feature permutation importance (deployed model) |

## 6. Limitations

- NSL-KDD/Kaggle "Network Intrusion Detection" is legacy benchmark traffic;
  none of these models is a production security control. Validate on current
  traffic before any operational use.
- Random-holdout scores are optimistic (Section 3.3). Report the KDDTest+
  numbers alongside holdout numbers.
- Gaussian Naive Bayes with all features is effectively unusable at the 0.5
  threshold (39% holdout / 15% external recall) despite high ROC-AUC; it is
  retained because it is one of the three `ids_results.py` models, and its
  top-30 variant is respectable (indeed the best external F1 here).
- The unpruned Decision Tree can memorize training patterns; its probability
  outputs are uncalibrated leaf fractions.
- Removing the previous ensembles/boosting intentionally trades the old
  study's higher capacity for the simpler, directly comparable
  `ids_results.py` model set; the old study's headline claims no longer apply.

## References

- `ids_results.py` (this folder) — source of the three model definitions,
  the all-features vs top-30 runs, the 80/20 split and 5-fold CV protocol.
- Kaggle "Network Intrusion Detection" (`Train_data.csv` / `Test_data.csv`),
  the CSV form of NSL-KDD `KDDTrain+_20Percent` / `KDDTest+`.
- NSL-KDD dataset mirror: https://github.com/jmnwong/NSL-KDD-Dataset
- Historical context for the removed model set: El-Taie, M., & Kraidi, A. Y.
  (2023). "Cybersecurity Detection Model using Machine Learning Techniques."
  *Journal of Cybersecurity and Information Management*, 12(1), 41–49.
  DOI: `10.54216/JCIM.120104` (copy in `reference/`).
