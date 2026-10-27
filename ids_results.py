"""
Decision Tree vs Naive Bayes vs SVM on the Kaggle "Network Intrusion Detection" data.

Setup:
    pip install pandas scikit-learn
Put Train_data.csv and Test_data.csv in the same folder as this script
(unzip them first), then run:
    python ids_results.py
SVM takes the longest (about a minute on 25k rows).
"""
import time
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.tree import DecisionTreeClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.svm import SVC
from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                             f1_score, confusion_matrix)

TRAIN_PATH = "Train_data.csv"
TEST_PATH = "Test_data.csv"      # has NO labels, so it is only used for predictions
TOP_K = 30                       # number of features kept in the "feature selection" run

# ---------- 1. Load ----------
train = pd.read_csv(TRAIN_PATH)
test = pd.read_csv(TEST_PATH)

y = (train["class"] != "normal").astype(int)   # normal -> 0, anomaly -> 1
X = train.drop(columns="class")

# ---------- 2. Preprocess ----------
# One-hot encode the text columns (protocol_type, service, flag).
# Train and test are encoded together so both get exactly the same columns.
text_cols = X.select_dtypes(exclude="number").columns.tolist()
both = pd.get_dummies(pd.concat([X, test]), columns=text_cols)
both = both.loc[:, both.nunique() > 1].astype(float)   # drop constant columns
X_all, X_test = both.iloc[:len(X)], both.iloc[len(X):]
print(f"Train rows: {len(X_all)} | Test rows: {len(X_test)} | "
      f"Features after encoding: {X_all.shape[1]}")


def make_models():
    # StandardScaler puts all features on a similar scale (important for SVM).
    return {
        "Decision Tree": make_pipeline(StandardScaler(), DecisionTreeClassifier(random_state=42)),
        "Naive Bayes":   make_pipeline(StandardScaler(), GaussianNB()),
        "SVM (RBF)":     make_pipeline(StandardScaler(), SVC(kernel="rbf", C=1.0)),
    }


def evaluate(features, title):
    # 80% to train, 20% held back to test; stratify keeps the normal/anomaly ratio equal
    X_tr, X_val, y_tr, y_val = train_test_split(
        features, y, test_size=0.2, random_state=42, stratify=y)
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    rows = []
    for name, model in make_models().items():
        start = time.time()
        model.fit(X_tr, y_tr)
        pred = model.predict(X_val)
        tn, fp, fn, tp = confusion_matrix(y_val, pred).ravel()
        rows.append({
            "Model": name,
            "Acc": accuracy_score(y_val, pred),
            "Prec": precision_score(y_val, pred),
            "Rec": recall_score(y_val, pred),
            "F1": f1_score(y_val, pred),
            "CV5 Acc": cross_val_score(model, features, y, cv=cv).mean(),
            "TN": tn, "FP": fp, "FN": fn, "TP": tp,
        })
        print(f"  done {name} ({time.time() - start:.0f}s)")
    pd.set_option("display.width", 200)
    print(f"\n=== {title} ===")
    print(pd.DataFrame(rows).set_index("Model").round(4))
    print("TN/FP/FN/TP = true normal, false alarm, missed attack, caught attack\n")


# ---------- 3. Run A: all features ----------
evaluate(X_all, "All features")

# ---------- 4. Run B: keep only the TOP_K features most correlated with the label ----------
corr = X_all.corrwith(y).abs().sort_values(ascending=False)
evaluate(X_all[corr.head(TOP_K).index], f"Top-{TOP_K} correlated features")

# ---------- 5. Predict on the unlabeled test file ----------
print("=== Predictions on Test_data.csv (no true labels, so no accuracy) ===")
for name, model in make_models().items():
    model.fit(X_all, y)                       # train on ALL labeled data
    pred = model.predict(X_test)
    print(f"{name}: {pred.mean() * 100:.1f}% of {len(pred)} rows predicted as anomaly")
