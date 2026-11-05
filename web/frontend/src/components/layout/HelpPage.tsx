import * as React from 'react';
import { ChevronDown, Shield } from 'lucide-react';

const faq = [
  ['What does CyberShield IDS do?', 'It serves a scikit-learn pipeline trained on NSL-KDD records and classifies the supplied 41 connection features as normal or anomalous. It is a research/demo IDS, not a replacement for production network controls.'],
  ['How does intrusion detection work here?', 'The API normalizes a connection record into the NSL-KDD feature schema and sends it to the ML service. The selected pipeline returns an anomaly score, which is compared with the configured decision threshold.'],
  ['What does the Decision Tree model do?', 'The shipped artifact is the Decision Tree pipeline selected using cross-validation F1. Its score is the proportion of anomalous training samples in a leaf; it should not be interpreted as a calibrated risk probability.'],
  ['How are predictions generated?', 'Single records and uploaded CSV files are submitted to the backend, which calls the ML service. Successful results are persisted to the signed-in user’s history when MongoDB is available.'],
  ['What are normal and anomalous traffic?', 'Normal means the model classified the supplied record below the threshold. Anomalous means its score met or exceeded the threshold. This is a model output, not proof of malicious activity.'],
  ['How should I interpret evaluation metrics?', 'Accuracy measures all correct classifications; precision measures how many flagged records were attacks; recall measures how many attacks were found; F1 balances precision and recall; ROC-AUC measures score ranking.'],
  ['What are the model limitations?', 'The model is trained and evaluated on NSL-KDD. Holdout scores are much higher than results on the official external KDDTest+ set, especially for novel attack patterns. Training data bias and score calibration also limit operational conclusions.'],
  ['What does Live Monitor show?', 'No live packet-capture or event source is configured, so Live Monitor does not display records. The former synthetic demo stream is disabled to avoid confusing generated examples with observed network activity.'],
  ['How do I use the dashboard?', 'Use Prediction to provide connection fields or a CSV, Model Comparison for offline evaluation results, History for saved inferences, and Live Monitor to check the current event-source status.'],
  ['Can I use sample inputs?', 'The Prediction page can load clearly identified example feature vectors for testing. Any result shown after submission is an actual inference from the configured model on the supplied example, not an observed network event.'],
  ['Where can I get support?', 'This project does not configure a support email or ticket service. The Help page links to the locally hosted API documentation for implemented endpoints.'],
] as const;

export default function HelpPage() {
  const [expanded, setExpanded] = React.useState<number | null>(0);
  return <div className="help-page">
    <div className="help-heading"><div className="help-icon"><Shield size={22} /></div><div><p className="eyebrow">CYBERSHIELD IDS</p><h2>Help &amp; reference</h2><p>How the current model, data, and dashboard work.</p></div></div>
    <section className="faq-list" aria-label="Frequently asked questions">{faq.map(([question, answer], index) => <article className="faq-item" key={question}><h3><button type="button" aria-expanded={expanded === index} onClick={() => setExpanded(expanded === index ? null : index)}>{question}<ChevronDown size={17} className={expanded === index ? 'rotate' : ''} /></button></h3>{expanded === index && <p>{answer}</p>}</article>)}</section>
    <section className="support-card"><h3>Need assistance?</h3><p>No support email or ticket service is configured in this project. For implementation and API details, use the local API documentation.</p><a href="/api-docs/" target="_blank" rel="noreferrer">Open API documentation <span aria-hidden="true">↗</span></a><button type="button" className="text-action" onClick={() => window.dispatchEvent(new CustomEvent('cybershield:cookie-settings'))}>Cookie preferences</button></section>
  </div>;
}
