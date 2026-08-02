import ftplib, socket
socket.setdefaulttimeout(15)

TESTS = [
    # candidate hosts
    ("ftp.lebongrace.com", "u298223980.shop.lebon-grace.com", "L8q!v3Nn7pR5tS2x"),
    ("ftp.shop.lebon-grace.com", "u298223980.shop.lebon-grace.com", "L8q!v3Nn7pR5tS2x"),
    ("45.87.81.174", "u298223980.shop.lebon-grace.com", "L8q!v3Nn7pR5tS2x"),
    # plain lebongrace.com
    ("lebongrace.com", "u298223980.shop.lebon-grace.com", "L8q!v3Nn7pR5tS2x"),
    # important: try both passwords for primary user
    ("ftp.lebongrace.com", "u298223980.shop.lebon-grace.com", "P4x!rT7#nQ2vL9s6"),
]

for host, user, pw in TESTS:
    print(f'--- {host} / {user} ---', flush=True)
    try:
        ft=ftplib.FTP(); ft.connect(host,21,timeout=15); ft.set_pasv(True)
        try:
            ft.login(user, pw)
            print('OK pwd=', ft.pwd())
            try: ft.cwd('/public_html/shop'); print(' shop ->', ft.pwd(), str(ft.nlst()[:3]))
            except Exception as e: print(' shop cd:', str(e)[:80])
            ft.quit(); break
        except ftplib.error_perm as e:
            print('AUTH:', str(e)[:80]); ft.quit()
    except Exception as e:
        print('ERR:', repr(e)[:80])
print('=== done ===')
