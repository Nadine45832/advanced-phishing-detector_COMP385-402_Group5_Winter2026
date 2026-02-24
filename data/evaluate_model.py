from sklearn.metrics import (
    classification_report, confusion_matrix,
    roc_auc_score, RocCurveDisplay, accuracy_score
)
import matplotlib.pyplot as plt
import seaborn as sns


def evaluate_models(model, X_test, y_test):
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]
    acc = accuracy_score(y_test, y_pred)
    auc = roc_auc_score(y_test == "Phishing Email", y_proba)
    results = {"accuracy": acc, "roc_auc": auc}

    print(classification_report(y_test, y_pred, target_names=["Safe", "Phishing"]))
    print(f"Accuracy : {acc} ROC-AUC : {auc}")

    fig, ax = plt.subplots(figsize=(6, 4))

    cm = confusion_matrix(y_test, y_pred)
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", ax=ax,
                xticklabels=["Safe", "Phishing"],
                yticklabels=["Safe", "Phishing"])
    ax.set_title(f"Acc={acc:.3f}  AUC={auc:.3f}")
    ax.set_ylabel("Actual")
    ax.set_xlabel("Predicted")
    plt.show()


    fig2, ax_roc = plt.subplots(figsize=(6, 4))
    RocCurveDisplay.from_predictions(y_test == "Phishing Email", y_proba, ax=ax_roc)

    ax_roc.plot([0, 1], [0, 1], "k--", label="Random")
    ax_roc.set_title("ROC Curves")
    ax_roc.legend()
    plt.show()

    return results