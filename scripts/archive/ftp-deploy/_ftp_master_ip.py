import ftplib, socket
socket.setdefaulttimeout(25)

def try_ftp(host, user, pw, label):
    try:
        print(f'=== {host} / {user} ({label}) ===', flush=True)
        ft=ftplib.FTP(); ft.connect(host,21,timeout=25); ft.set_pasv(True)
        try:
            ft.login(user, pw)
            print('OK pwd=', ft.pwd())
            print('root:', ft.nlst()[:10])
            try: ft.cwd('/public_html/shop'); print('shop ->', ft.pwd(), str(ft.nlst()[:5]))
            except Exception as e: print('shop cd:', str(e)[:70])
            ft.quit(); return host
        except ftplib.error_perm as e:
            print('AUTH:', str(e)[:70]); ft.quit()
    except Exception as e:
        print('ERR:', repr(e)[:70])
    return None

USER="u298223980"
PASS="@8.Beni.Sage.Reussi.5"
for host in ['147.79.97.138', 'ftp.new.lebon-grace.com', 'ftp.lebongrace.com']:
    r = try_ftp(host, USER, PASS, 'master')
    if r: break
print('=== done ===')
