import zipfile, os
base=os.getcwd()
excl={'node_modules','.next','.data','.git'}
count=0
with zipfile.ZipFile('deploy_src.zip','w',zipfile.ZIP_DEFLATED) as z:
    for root,dirs,files in os.walk(base):
        dirs[:]=[d for d in dirs if d not in excl]
        for f in files:
            full=os.path.join(root,f)
            rel=os.path.relpath(full,base)
            if rel.startswith('deploy') or rel.startswith('scripts/_') or rel.startswith('.'): 
                if not rel.startswith('.env'): continue
            z.write(full,rel); count+=1
print('zipped',count,'files')
