import ftplib, socket
socket.setdefaulttimeout(30)
HOST = "ftp.shop.lebon-grace.com"
USER = "u298223980.Shop1A"
PASS = "R7m!q2Lx9vP4sT6n"
ft = ftplib.FTP(); ft.connect(HOST, 21, timeout=30); ft.set_pasv(True)
print("login ...", flush=True)
ft.login(USER, PASS)
print("OK pwd =", ft.pwd())
print("i am here")
try:
    ft.cwd("/public_html/shop")
    print("shop dir ->", ft.pwd(), str(ft.nlst()[:10]))
except Exception as e:
    print("shop cd:", e)
ft.quit()
