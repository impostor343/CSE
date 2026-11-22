#!/usr/bin/env python3
"""Configures secure shared release signing in android/app/build.gradle for Bytewise & Luma.

Signing secrets are NEVER hardcoded or committed to git. At build time Gradle reads them from:
  1) Environment variables:
       SHARED_RELEASE_KEYSTORE_PATH
       SHARED_RELEASE_KEYSTORE_PASSWORD
       SHARED_RELEASE_KEY_ALIAS
       SHARED_RELEASE_KEY_PASSWORD
  2) Or an untracked local file: android/signing.properties (ignored by .gitignore).

Debug builds continue using the debug keystore unchanged.
Release builds require all four shared release signing values so Bytewise and Luma
always share the same cryptographic signing identity for Android signature-level IPC.

Safe to run multiple times."""

import os
import sys

gradle_path = os.path.join("android", "app", "build.gradle")
if not os.path.isfile(gradle_path):
    sys.exit("configure_signing: build.gradle not found at " + gradle_path)

text = open(gradle_path, encoding="utf-8").read()
MARKER = "// BYTEWISE_LUMA_SHARED_SIGNING"

if MARKER in text:
    print("build.gradle already configured for shared release signing")
    sys.exit(0)

SIGNING_LOADER = '''
// BYTEWISE_LUMA_SHARED_SIGNING
def sharedSigningProps = new Properties()
def sharedSigningFile = rootProject.file("signing.properties")
if (sharedSigningFile.exists()) {
    sharedSigningFile.withInputStream { sharedSigningProps.load(it) }
}
def sharedSigningValue = { String envKey, String propKey ->
    def v = System.getenv(envKey)
    if (v != null && !v.trim().isEmpty()) { return v.trim() }
    def p = sharedSigningProps.getProperty(propKey)
    return p != null ? p.trim() : ""
}
def sharedStorePath = sharedSigningValue("SHARED_RELEASE_KEYSTORE_PATH", "storeFile")
def sharedStorePass = sharedSigningValue("SHARED_RELEASE_KEYSTORE_PASSWORD", "storePassword")
def sharedKeyAlias  = sharedSigningValue("SHARED_RELEASE_KEY_ALIAS", "keyAlias")
def sharedKeyPass   = sharedSigningValue("SHARED_RELEASE_KEY_PASSWORD", "keyPassword")
def hasSharedReleaseSigning = !sharedStorePath.isEmpty() && !sharedStorePass.isEmpty() && !sharedKeyAlias.isEmpty() && !sharedKeyPass.isEmpty()
'''

SIGNING_CONFIG_BLOCK = '''    signingConfigs {
        release {
            if (hasSharedReleaseSigning) {
                storeFile file(sharedStorePath)
                storePassword sharedStorePass
                keyAlias sharedKeyAlias
                keyPassword sharedKeyPass
            }
        }
    }
'''

RELEASE_GUARD = '''
gradle.taskGraph.whenReady { taskGraph ->
    def buildingRelease = taskGraph.allTasks.any { t ->
        def n = t.name.toLowerCase(java.util.Locale.ROOT)
        n.contains("release") && (n.contains("assemble") || n.contains("bundle") || n.contains("package"))
    }
    if (buildingRelease && !hasSharedReleaseSigning) {
        throw new GradleException(
            "Shared release signing credentials are missing. Provide SHARED_RELEASE_KEYSTORE_PATH, " +
            "SHARED_RELEASE_KEYSTORE_PASSWORD, SHARED_RELEASE_KEY_ALIAS, and SHARED_RELEASE_KEY_PASSWORD " +
            "(or untracked android/signing.properties) so Bytewise and Luma share the same signing key."
        )
    }
}
'''

if "android {" not in text:
    sys.exit("configure_signing: 'android {' block not found in " + gradle_path)
if "buildTypes {" not in text:
    sys.exit("configure_signing: 'buildTypes {' block not found in " + gradle_path)
if "        release {" not in text:
    sys.exit("configure_signing: 'release {' block not found in " + gradle_path)

# 1. Insert signing loader just before `android {`
text = text.replace("android {", SIGNING_LOADER.lstrip("\n") + "\nandroid {", 1)

# 2. Attach signingConfig signingConfigs.release inside `buildTypes { release { ... } }` FIRST
text = text.replace(
    "    buildTypes {\n        release {",
    "    buildTypes {\n        release {\n            if (hasSharedReleaseSigning) {\n                signingConfig signingConfigs.release\n            }",
    1,
)

# 3. Insert signingConfigs block right before `buildTypes {`
text = text.replace("    buildTypes {", SIGNING_CONFIG_BLOCK + "    buildTypes {", 1)

# 4. Append release guard at end of file
text = text.rstrip() + "\n" + RELEASE_GUARD

with open(gradle_path, "w", encoding="utf-8", newline="\n") as f:
    f.write(text)

print("configured shared release signing in", gradle_path)
