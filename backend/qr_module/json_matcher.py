from difflib import SequenceMatcher

def normalize(value):
    if not value:
        return ""
    return value.strip().lower()

def similarity(a, b):
    return SequenceMatcher(None, a, b).ratio()

def match_json(ocr_data, api_data, threshold=0.7):
    """
    cert_id = strict match
    name, course = fuzzy match
    threshold = similarity score (0.8 = 80%)
    """

    mismatches = []
    scores = {}

    # STRICT
    ocr_cert = normalize(ocr_data.get("cert_id"))
    api_cert = normalize(api_data.get("cert_id"))

    if ocr_cert != api_cert:
        mismatches.append("cert_id")
        scores["cert_id"] = 0.0
    else:
        scores["cert_id"] = 1.0

    # FUZZY
    for field in ["name", "course"]:
        ocr_val = normalize(ocr_data.get(field))
        api_val = normalize(api_data.get(field))

        score = similarity(ocr_val, api_val)
        scores[field] = round(score, 2)

        if score < threshold:
            mismatches.append(field)

    return {
        "match": len(mismatches) == 0,
        "mismatched_fields": mismatches,
        "similarity_scores": scores
    }