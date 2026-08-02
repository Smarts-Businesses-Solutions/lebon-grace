import base64, json, subprocess, os, tempfile
KEY=os.environ.get("HOSTINGER_KEY")
U="u298223980"; D="shop.lebon-grace.com"
data=open("deploy_src.zip","rb").read()
b64=base64.b64encode(data).decode()
payload={"archive":b64,"node_version":20,"root_directory":"/","entry_file":"server.js","build_script":"build","package_manager":"npm"}
body=json.dumps(payload).encode()
tf=tempfile.NamedTemporaryFile(delete=False,suffix=".json")
tf.write(body); tf.close()
print(f"payload file {len(body)/1e3:.0f}KB", flush=True)
r=subprocess.run(["curl","-s","-X","POST",
  f"https://developers.hostinger.com/api/hosting/v1/accounts/{U}/websites/{D}/nodejs/builds/from-archive",
  "-H",f"Authorization: Bearer {KEY}",
  "-H","Content-Type: application/json",
  "--data-binary", f"@{tf.name}"],
  capture_output=True,text=True,timeout=90)
os.unlink(tf.name)
print("rc:", r.returncode)
print("RESP:", r.stdout[:900])
