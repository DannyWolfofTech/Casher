"""Inspect a real locally signed App.app; --for-store also rejects development signing."""
import argparse
import json
import plistlib
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('app', type=Path)
parser.add_argument('--for-store', action='store_true')
args = parser.parse_args()
app = args.app.resolve()
info = plistlib.loads((app / 'Info.plist').read_bytes())
assert info['CFBundleIdentifier'] == 'com.trycasher.app'
assert info['CFBundleDisplayName'] == 'Casher'
assert any('com.trycasher.app' in entry.get('CFBundleURLSchemes', []) for entry in info.get('CFBundleURLTypes', [])), 'Missing browser-to-app authentication fallback'
assert info['CFBundleSupportedPlatforms'] == ['iPhoneOS']
assert int(info['DTSDKName'].removeprefix('iphoneos').split('.')[0]) >= 26
subprocess.run(['codesign','--verify','--deep','--strict',str(app)], check=True, capture_output=True)
ent = plistlib.loads(subprocess.check_output(['codesign','-d','--entitlements',':-',str(app)], stderr=subprocess.DEVNULL))
identifier = ent['application-identifier']
assert identifier.endswith('.com.trycasher.app')
assert 'applinks:trycasher.com' in ent['com.apple.developer.associated-domains']
profile = plistlib.loads(subprocess.check_output(['security','cms','-D','-i',str(app/'embedded.mobileprovision')], stderr=subprocess.DEVNULL))
assert profile['Entitlements']['application-identifier'] == identifier
association = json.loads(Path('public/.well-known/apple-app-site-association').read_text())
assert association['applinks']['details'][0]['appIDs'] == [identifier]
assert association['applinks']['details'][0]['components'] == [{'/':'/auth','comment':'Casher email confirmation and password recovery'}]
config = json.loads((app/'capacitor.config.json').read_text())
assert config['loggingBehavior'] == 'none'
assert not config['server'].get('url') and config['server']['cleartext'] is False
scripts = '\n'.join(p.read_text() for p in (app/'public/assets').glob('*.js'))
assert 'https://ewnjmvxildwmbdmosasz.supabase.co' in scripts
assert '127.0.0.1:54329' not in scripts
assert 'Clear imported statements' in scripts
assert 'Help and support' in scripts
privacy = plistlib.loads((app/'PrivacyInfo.xcprivacy').read_bytes())
assert privacy['NSPrivacyTracking'] is False
categories = {d['NSPrivacyCollectedDataType'] for d in privacy['NSPrivacyCollectedDataTypes']}
assert {'NSPrivacyCollectedDataTypeEmailAddress','NSPrivacyCollectedDataTypeUserID','NSPrivacyCollectedDataTypeOtherFinancialInfo','NSPrivacyCollectedDataTypePurchaseHistory','NSPrivacyCollectedDataTypeCrashData'} <= categories
assert all(not d['NSPrivacyCollectedDataTypeTracking'] for d in privacy['NSPrivacyCollectedDataTypes'])
distribution = not ent.get('get-task-allow', False) and 'ProvisionedDevices' not in profile
if args.for_store:
    assert distribution, 'Development/ad-hoc signing cannot be submitted as an App Store distribution build'
print(json.dumps({'bundleId':info['CFBundleIdentifier'],'version':info['CFBundleShortVersionString'],'build':info['CFBundleVersion'],'sdk':info['DTSDKName'],'identifier':identifier,'signatureVerified':True,'associatedDomainMatchesSource':True,'productionApi':True,'privacyManifest':True,'distributionSigned':distribution},indent=2))
