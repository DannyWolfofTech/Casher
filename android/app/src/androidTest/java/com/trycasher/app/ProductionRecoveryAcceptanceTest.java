package com.trycasher.app;

import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;
import android.content.Intent;
import android.net.Uri;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Opt-in actual provider recovery; no test identity or callback is packaged into the app. */
@RunWith(AndroidJUnit4.class)
public class ProductionRecoveryAcceptanceTest {
    private String js(ActivityScenario<MainActivity> scene,String code) throws Exception {
        AtomicReference<String> value=new AtomicReference<>();CountDownLatch ready=new CountDownLatch(1);
        scene.onActivity(a->a.getBridge().getWebView().evaluateJavascript(code,v->{value.set(v);ready.countDown();}));
        assertTrue("Release UI timed out",ready.await(10,TimeUnit.SECONDS));return value.get();
    }
    private void until(ActivityScenario<MainActivity> scene,String condition,String label,int seconds) throws Exception {
        long deadline=System.currentTimeMillis()+seconds*1000L;
        while(System.currentTimeMillis()<deadline){if("true".equals(js(scene,"Boolean("+condition+")")))return;Thread.sleep(200);}
        fail(label);
    }
    private void input(ActivityScenario<MainActivity> scene,String id,String value) throws Exception {
        js(scene,"(()=>{const e=document.getElementById("+JSONObject.quote(id)+");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,"+JSONObject.quote(value)+");e.dispatchEvent(new Event('input',{bubbles:true}));})()");
    }
    private void button(ActivityScenario<MainActivity> scene,String label) throws Exception {
        String control="Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==="+JSONObject.quote(label)+" && !b.disabled && b.getBoundingClientRect().width>0)";
        until(scene,control,"Expected control unavailable: "+label,30);js(scene,control+".click()");
    }
    private void logout(ActivityScenario<MainActivity> scene) throws Exception {
        until(scene,"document.querySelector('button[aria-label=\"Open menu\"]')","Dashboard unavailable",40);
        js(scene,"document.querySelector('button[aria-label=\"Open menu\"]').click()");button(scene,"Sign Out");
        until(scene,"location.pathname==='/auth' && document.getElementById('email')","Logout failed",30);
    }
    @Test public void rejectInvalidRecoveryLinksOnColdAndWarmActivity() throws Exception {
        Intent cold=new Intent(InstrumentationRegistry.getInstrumentation().getTargetContext(),MainActivity.class)
            .setAction(Intent.ACTION_VIEW).setData(Uri.parse("https://trycasher.com/auth?mode=recovery&code=casher-invalid-"+java.util.UUID.randomUUID()));
        try(ActivityScenario<MainActivity> scene=ActivityScenario.launch(cold)){
            until(scene,"location.search==='?error=callback' && document.querySelector('[role=alert]')","Cold invalid link did not show a recoverable error",45);
            assertEquals("false",js(scene,"Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Save new password'&&!b.disabled)"));
            button(scene,"Request a new reset link");
            until(scene,"document.body.innerText.includes('Reset your password') && document.getElementById('email')","Recovery retry form unavailable",15);
            Intent warm=new Intent(InstrumentationRegistry.getInstrumentation().getTargetContext(),MainActivity.class)
                .setAction(Intent.ACTION_VIEW).setData(Uri.parse("https://trycasher.com/auth?mode=recovery&code=casher-invalid-"+java.util.UUID.randomUUID()));
            scene.onActivity(a->a.startActivity(warm));
            until(scene,"location.search==='?error=callback' && document.querySelector('[role=alert]')","Warm invalid link did not show a recoverable error",45);
            assertEquals("false",js(scene,"Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Save new password'&&!b.disabled)"));
            assertEquals("false",js(scene,"Object.keys(localStorage).some(k=>k.includes('auth-token'))"));
            button(scene,"Request a new reset link");
        }
    }
    @Test public void recoverThroughActualEmailAndNativePkce() throws Exception {
        android.os.Bundle args=InstrumentationRegistry.getArguments();
        String phase=args.getString("recoveryPhase","");assumeTrue("Requires explicit provider recovery acceptance",!phase.isEmpty());
        assertTrue(phase.equals("warm")||phase.equals("cold-request")||phase.equals("cold-complete"));
        String email=args.getString("acceptanceEmail","");
        assertTrue(email.matches("privacy\\+release-[0-9a-f-]{36}@trycasher\\.com"));
        String oldPassword=args.getString("acceptancePassword","");
        String newPassword=args.getString("newPassword","");assertTrue(newPassword.length()>30);
        Intent launch=new Intent(InstrumentationRegistry.getInstrumentation().getTargetContext(),MainActivity.class);
        if(phase.equals("cold-complete")){
            Uri uri=Uri.parse(args.getString("callbackUrl",""));
            assertEquals("https",uri.getScheme());assertEquals("trycasher.com",uri.getHost());assertEquals("/auth",uri.getPath());
            assertEquals("recovery",uri.getQueryParameter("mode"));assertNotNull(uri.getQueryParameter("code"));
            launch.setAction(Intent.ACTION_VIEW).setData(uri).addCategory(Intent.CATEGORY_BROWSABLE);
        }
        try(ActivityScenario<MainActivity> scene=ActivityScenario.launch(launch)){
            if(!phase.equals("cold-complete")){
                until(scene,"document.getElementById('email')","Native sign-in unavailable",40);
                button(scene,"Forgot password?");input(scene,"email",email);button(scene,"Send reset link");
                until(scene,"document.body.innerText.includes('If an account exists for this email')","Provider rejected the recovery request",45);
                System.out.println("CASHER_RECOVERY_REQUESTED "+phase);
                if(phase.equals("cold-request"))return;
                // The operator opens only this disposable account's real delivered callback via Android.
            }
            until(scene,"document.getElementById('confirm-password') && Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Save new password'&&!b.disabled)","The native PKCE recovery callback did not become usable",300);
            input(scene,"password",newPassword);input(scene,"confirm-password",newPassword);button(scene,"Save new password");
            until(scene,"location.pathname==='/dashboard'","Password replacement did not finish",45);
            assertEquals("false",js(scene,"Object.keys(localStorage).some(k=>k.includes('auth-token'))"));
            logout(scene);
            input(scene,"email",email);input(scene,"password",oldPassword);button(scene,"Sign in");
            until(scene,"document.querySelector('[role=alert]')","Previous password remained usable",30);
            assertEquals("true",js(scene,"location.pathname==='/auth'"));
            input(scene,"password",newPassword);button(scene,"Sign in");
            until(scene,"location.pathname==='/dashboard'","New password could not sign in",45);
            logout(scene);
            System.out.println("CASHER_RECOVERY_VERIFIED "+phase);
        }
    }
}
