# NFR-1: không mạng, không bao giờ. Mọi lối ra ngoài phải thất bại.
import socket

try:
    socket.setdefaulttimeout(3)
    s = socket.create_connection(("1.1.1.1", 53), timeout=3)
    s.close()
    print("NET_OK")
except Exception as exc:
    print("NET_FAIL", type(exc).__name__)

try:
    print("DNS_OK", socket.gethostbyname("example.com"))
except Exception as exc:
    print("DNS_FAIL", type(exc).__name__)
