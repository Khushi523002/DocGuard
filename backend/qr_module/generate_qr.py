import qrcode

cert_id = "LMN456"

url = f"http://127.0.0.1:8000/api/verify?cert_id={cert_id}"

qr = qrcode.make(url)
qr.save("certificate_qr3.png")

print("QR GENERATED:")
print(url)