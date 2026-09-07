package com.trycasher.app;

import static org.junit.Assert.*;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.security.NetworkSecurityPolicy;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.nio.file.Files;
import java.io.File;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** Runs against the signed, non-debuggable release target on an Android device. */
@RunWith(AndroidJUnit4.class)
public class ReleaseAcceptanceTest {
    private String js(ActivityScenario<MainActivity> scenario, String expression) throws Exception {
        AtomicReference<String> result = new AtomicReference<>();
        CountDownLatch done = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(expression, value -> { result.set(value); done.countDown(); }));
        assertTrue("WebView response timed out", done.await(10, TimeUnit.SECONDS));
        return result.get();
    }
    private void ready(ActivityScenario<MainActivity> scenario) throws Exception {
        long until = System.currentTimeMillis() + 30000;
        while (System.currentTimeMillis() < until) {
            if ("true".equals(js(scenario, "Boolean(document.querySelector('h1') && document.documentElement.classList.contains('native-app'))"))) return;
            Thread.sleep(200);
        }
        fail("Bundled release did not render its native UI");
    }
    private String promise(ActivityScenario<MainActivity> scenario, String expression) throws Exception {
        String id = "test" + UUID.randomUUID().toString().replace("-", "");
        js(scenario, "window['" + id + "']=null;Promise.resolve(" + expression + ").then(v=>window['"+id+"']={ok:true,value:v},()=>window['"+id+"']={ok:false});");
        long until = System.currentTimeMillis() + 10000;
        while (System.currentTimeMillis() < until) {
            String value = js(scenario, "window['" + id + "']");
            if (value != null && !value.equals("null")) {
                js(scenario, "delete window['"+id+"']");
                JSONObject parsed = new JSONObject(value);
                assertTrue("Native plugin rejected request", parsed.getBoolean("ok"));
                return parsed.optJSONObject("value") == null ? "{}" : parsed.getJSONObject("value").toString();
            }
            Thread.sleep(100);
        }
        throw new AssertionError("Native plugin did not respond");
    }

    @Test public void releaseUsesProductionIdentityAndRestrictivePermissions() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        ApplicationInfo info = context.getApplicationInfo();
        assertEquals("com.trycasher.app", context.getPackageName());
        assertEquals(0, info.flags & ApplicationInfo.FLAG_DEBUGGABLE);
        assertEquals(0, info.flags & ApplicationInfo.FLAG_ALLOW_BACKUP);
        assertFalse(NetworkSecurityPolicy.getInstance().isCleartextTrafficPermitted());
        assertTrue(info.targetSdkVersion >= 36);
        JSONObject config = new JSONObject(new String(context.getAssets().open("capacitor.config.json").readAllBytes(), java.nio.charset.StandardCharsets.UTF_8));
        assertFalse(config.getJSONObject("android").getBoolean("webContentsDebuggingEnabled"));
        assertFalse(config.getJSONObject("server").has("url"));
    }

    @Test public void secureStorageSurvivesActivityRecreationWithoutPlaintextFiles() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        String key = "casher.auth.release-acceptance";
        String marker = "synthetic-vault-" + UUID.randomUUID();
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            assertEquals("\"https://localhost\"", js(scenario, "location.origin"));
            promise(scenario, "Capacitor.nativePromise('SecureStorage','internalSetItem',{prefixedKey:'"+key+"',data:'"+marker+"'})");
            scenario.recreate(); ready(scenario);
            String read = promise(scenario, "Capacitor.nativePromise('SecureStorage','internalGetItem',{prefixedKey:'"+key+"'})");
            assertEquals(marker, new JSONObject(read).getString("data"));
            File prefs = new File(context.getApplicationInfo().dataDir, "shared_prefs");
            File[] files = prefs.listFiles();
            assertNotNull(files);
            for (File file : files) if (file.isFile()) {
                assertFalse("Secure storage leaked plaintext into preferences", new String(Files.readAllBytes(file.toPath()), java.nio.charset.StandardCharsets.UTF_8).contains(marker));
            }
            assertFalse(js(scenario,"JSON.stringify({...localStorage})").contains(marker));
            promise(scenario, "Capacitor.nativePromise('SecureStorage','internalRemoveItem',{prefixedKey:'"+key+"'})");
        }
    }
}
