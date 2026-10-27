"""Simple Streamlit UI for the saved NSL-KDD intrusion-detection model.

Run the training script first, then start this app from the research folder:
    streamlit run app.py --server.address 0.0.0.0 --server.port 8501
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd
import streamlit as st

ROOT = Path(__file__).resolve().parent
RESULTS = ROOT / "results"
MODEL_PATH = RESULTS / "ids_model.joblib"
METADATA_PATH = RESULTS / "model_metadata.json"

st.set_page_config(page_title="IDS Model Demo", page_icon="🛡️", layout="wide")
st.title("Network Intrusion Detection — Model Demo")
st.caption("Enter one NSL-KDD-style connection record and get a normal/anomaly prediction.")

if not MODEL_PATH.exists() or not METADATA_PATH.exists():
    st.error("The trained model artifact is missing. Train and save it first:")
    st.code("python cybersecurity_ids_study.py --train Train_data.csv --test Test_data.csv "
            "--external-test data/KDDTest+.txt --out results --cv 5")
    st.stop()

@st.cache_resource
def load_artifacts():
    metadata = json.loads(METADATA_PATH.read_text())
    model = joblib.load(MODEL_PATH)
    return model, metadata

try:
    model, metadata = load_artifacts()
except Exception as exc:
    st.error(f"Could not load the saved model: {exc}")
    st.info("From the project folder, install the app dependencies with: `pip install -r requirements-web.txt`.")
    st.stop()

st.markdown(
    f"**Loaded model:** {metadata['model_name']} ({metadata.get('feature_set', 'All features')})  ·  "
    f"**Positive class:** {metadata['positive_class']}  ·  "
    f"**Saved threshold:** `{metadata['threshold']:.5g}`"
)

st.warning(
    "Demonstration only. The model is trained on the legacy NSL-KDD benchmark and is not a production security control. "
    "Its probability-like output is not calibrated risk; validate on current traffic before any operational use."
)

examples = metadata.get("demo_samples", {})
preset_labels = {
    "Blank / custom record": None,
    "Example record — normal": "normal",
    "Example record — anomaly": "anomaly",
}
preset = st.selectbox("Start with", list(preset_labels.keys()), index=0)
preset_key = preset_labels[preset]
example = examples.get(preset_key, {}) if preset_key else {}

threshold = st.number_input(
    "Decision threshold (adjust to explore the false-alarm / missed-attack trade-off)",
    value=float(metadata.get("threshold", 0.5)),
    step=0.01,
    format="%.5f",
    help="The saved operating threshold is the default. Lowering it usually flags more records, including more false alarms.",
)

feature_columns = metadata["feature_columns"]
categorical_columns = set(metadata["categorical_columns"])
categorical_options = metadata["categorical_options"]
input_row = {}

with st.form("traffic_record_form"):
    st.subheader("Connection features")
    st.caption("All 41 input fields are shown. The training-only `difficulty` field is intentionally not included.")
    left, right = st.columns(2)
    for i, feature in enumerate(feature_columns):
        target_column = left if i % 2 == 0 else right
        with target_column:
            default_value = example.get(feature)
            widget_key = f"{preset}:{feature}"
            if feature in categorical_columns:
                options = list(categorical_options.get(feature, []))
                if not options:
                    options = ["__missing__"]
                if default_value not in options:
                    default_value = options[0]
                default_index = options.index(default_value)
                input_row[feature] = st.selectbox(
                    feature,
                    options=options,
                    index=default_index,
                    key=widget_key,
                )
            else:
                if default_value is None:
                    default_value = 0.0
                default_value = float(default_value)
                is_rate = "rate" in feature
                input_row[feature] = st.number_input(
                    feature,
                    value=default_value,
                    step=0.01 if is_rate else 1.0,
                    format="%.4f" if is_rate else "%.0f",
                    key=widget_key,
                )
    submitted = st.form_submit_button("Classify connection", type="primary", use_container_width=True)

if submitted:
    row = pd.DataFrame([input_row], columns=feature_columns)
    if hasattr(model, "predict_proba"):
        probability_matrix = model.predict_proba(row)
        classes = list(getattr(model, "classes_", [0, 1]))
        score = float(probability_matrix[0, classes.index(1)]) if 1 in classes else float(probability_matrix[0, -1])
        score_label = "Anomaly score (model probability output; uncalibrated)"
    elif hasattr(model, "decision_function"):
        score = float(model.decision_function(row)[0])
        score_label = "Anomaly decision score"
    else:
        score = float(model.predict(row)[0])
        score_label = "Predicted class score"

    is_anomaly = score >= threshold
    result_col, score_col, threshold_col = st.columns(3)
    result_col.metric("Prediction", "ANOMALY" if is_anomaly else "NORMAL")
    score_col.metric(score_label, f"{score:.5f}")
    threshold_col.metric("Threshold", f"{threshold:.5f}")
    if is_anomaly:
        st.error("Flagged as an anomaly by the selected model and threshold.")
    else:
        st.success("Classified as normal by the selected model and threshold.")
    with st.expander("Inspect the submitted feature row"):
        st.dataframe(row, use_container_width=True)
    st.download_button(
        "Download this input row as CSV",
        data=row.to_csv(index=False).encode("utf-8"),
        file_name="traffic_record.csv",
        mime="text/csv",
    )

with st.expander("About the example presets"):
    st.write(
        "The normal/anomaly presets are individual records from the training file, included to test the interface. "
        "They are not independent test cases and should not be used to estimate model accuracy."
    )
