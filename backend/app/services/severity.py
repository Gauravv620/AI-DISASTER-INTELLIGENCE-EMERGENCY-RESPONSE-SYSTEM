def classify_severity(government_severity: str | None, ml_probability: float | None) -> str:
    if government_severity and government_severity.lower() in {"extreme", "critical"}:
        return "CRITICAL"
    if government_severity and government_severity.lower() == "severe":
        return "HIGH"
    if ml_probability is None:
        return "LOW"
    if ml_probability >= 0.85:
        return "HIGH"
    if ml_probability >= 0.60:
        return "MEDIUM"
    return "LOW"
