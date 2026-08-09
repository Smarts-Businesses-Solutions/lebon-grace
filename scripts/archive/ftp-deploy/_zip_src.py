import zipfile, os
base=os.getcwd()
excl={'node_modules','.next','.data','.git','public','deploy','scripts','screenshots','test-screenshots'}
count=0; size=0
with zipfile.ZipFile('deploy_src.zip','w',zipfile.ZIP_DEFLATED) as z:
    for root,dirs,files in os.walk(base):
        dirs[:]=[d for d in dirs if d not in excl]
        for f in files:
            full=os.path.join(root,f); rel=os.path.relpath(full,base)
            if rel.startswith(('deploy','scripts','screenshots','test-screenshots')): continue
            if rel.startswith('.'):
                if not (rel.startswith('.env') or rel=='.gitignore'): continue
            z.write(full,rel); count+=1; size+=os.path.getsize(full)
print(f'zipped {count} files, {size/1e6:.2f} MB')
