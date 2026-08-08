import ftplib, socket
socket.setdefaulttimeout(30)
HOST="ftp.lebongrace.com"
USER="u298223980"
PASS="@8.Beni.Sage.Reussi.5"
print("connecting",HOST,"...",flush=True)
ft=ftplib.FTP(); ft.connect(HOST,21,timeout=30); ft.set_pasv(True)
print("login ...",flush=True)
ft.login(USER,PASS)
print("OK pwd=",ft.pwd())
try: ft.cwd('/public_html/shop'); print('shop ->', ft.pwd(), str(ft.nlst()[:5]))
except Exception as e: print('shop cd:', str(e)[:80])
ft.quit()
