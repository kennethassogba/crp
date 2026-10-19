"""Package the current research engine with frozen inputs; no network or secrets."""
from pathlib import Path
import json
import zipfile

root = Path(__file__).resolve().parent.parent
out = root / 'public' / 'research'
(out / 'protocole.md').write_text((root / 'docs/warrants-method.md').read_text())
with zipfile.ZipFile(out / 'recherche.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in ['protocole.md', 'schema.json', 'snapshot.json', 'catalogue.csv', 'reference-palantir.json', 'analyse-reference.py']:
        archive.write(out / name, 'public/research/' + name)
    for name in ['lib/warrants.mjs', 'lib/site-routing.mjs', 'scripts/research-collect.mjs', 'scripts/research-screen.mjs', 'tests/warrants.test.mjs']:
        archive.write(root / name, name)
    archive.writestr('package.json', json.dumps({'name':'fin-research','private':True,'type':'module','scripts':{'test':'node --test tests/warrants.test.mjs','screen':'node scripts/research-screen.mjs','collect':'node scripts/research-collect.mjs'}}))
    archive.writestr('README.md', '# fin — moteur de recherche\n\nNode.js 24. Aucune dépendance externe pour les calculs.\n\n    npm test\n    npm run screen\n    npm run collect -- --output output/snapshot.json\n\nLe protocole complet est public/research/protocole.md.\nLa référence indépendante : python3 public/research/analyse-reference.py.\n\nPrix figés au 16 octobre 2026. Aucun avantage prédictif validé.\n')
print('Packaged current engine, protocol and frozen inputs.')
