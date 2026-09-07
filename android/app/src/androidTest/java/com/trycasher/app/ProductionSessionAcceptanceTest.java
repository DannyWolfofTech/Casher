package com.trycasher.app;

import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.nio.file.Files;
import android.view.accessibility.AccessibilityNodeInfo;
import android.accessibilityservice.AccessibilityService;
import android.content.ContentValues;
import android.net.Uri;
import android.provider.MediaStore;
import java.io.OutputStream;

/** Explicit opt-in; credentials are runner arguments, never shipped app assets. */
@RunWith(AndroidJUnit4.class)
public class ProductionSessionAcceptanceTest {
    private String js(ActivityScenario<MainActivity> scene,String code) throws Exception {
        AtomicReference<String> result=new AtomicReference<>();CountDownLatch done=new CountDownLatch(1);
        scene.onActivity(a->a.getBridge().getWebView().evaluateJavascript(code,v->{result.set(v);done.countDown();}));
        assertTrue("Release UI response timed out",done.await(10,TimeUnit.SECONDS));return result.get();
    }
    private void waitFor(ActivityScenario<MainActivity> scene,String condition,String label) throws Exception {
        long end=System.currentTimeMillis()+45000;
        while(System.currentTimeMillis()<end){if("true".equals(js(scene,"Boolean("+condition+")")))return;Thread.sleep(200);}
        fail(label);
    }
    private void input(ActivityScenario<MainActivity> scene,String selector,String value) throws Exception {
        js(scene,"(()=>{const e=document.querySelector("+JSONObject.quote(selector)+");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,"+JSONObject.quote(value)+");e.dispatchEvent(new Event('input',{bubbles:true}));})()");
    }
    private void button(ActivityScenario<MainActivity> scene,String label) throws Exception {
        String match="Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==="+JSONObject.quote(label)+" && b.getBoundingClientRect().width>0)";
        waitFor(scene,match,"Expected control unavailable: "+label);js(scene,match+".click()");
    }
    private void menu(ActivityScenario<MainActivity> scene) throws Exception {
        waitFor(scene,"document.querySelector('button[aria-label=\"Open menu\"]')","Dashboard menu unavailable");
        js(scene,"document.querySelector('button[aria-label=\"Open menu\"]').click()");
    }
    private void selectDocument(String filename) throws Exception {
        long deadline=System.currentTimeMillis()+20000;
        while(System.currentTimeMillis()<deadline){
            AccessibilityNodeInfo root=InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow();
            if(root!=null && root.getPackageName()!=null && root.getPackageName().toString().contains("intentresolver")){
                for(AccessibilityNodeInfo match:root.findAccessibilityNodeInfosByText("Files")){
                    AccessibilityNodeInfo target=match;
                    while(target!=null && !target.isClickable())target=target.getParent();
                    if(target!=null)target.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                }
            }
            if(root!=null && root.getPackageName()!=null && root.getPackageName().toString().contains("documentsui")){
                for(AccessibilityNodeInfo match:root.findAccessibilityNodeInfosByText(filename)){
                    AccessibilityNodeInfo target=match;
                    while(target!=null && !target.isClickable())target=target.getParent();
                    if(target!=null && target.performAction(AccessibilityNodeInfo.ACTION_CLICK))return;
                }
            }
            Thread.sleep(200);
        }
        dumpPicker(InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow());
        fail("CSV was not selectable in the Android system document picker");
    }
    private void dumpPicker(AccessibilityNodeInfo node) {
        if(node==null)return;
        System.out.println("Picker: "+node.getPackageName()+" | "+node.getText()+" | "+node.getContentDescription());
        for(int i=0;i<node.getChildCount();i++)dumpPicker(node.getChild(i));
    }
    private void tapFileControl(ActivityScenario<MainActivity> scene) throws Exception {
        String encoded=js(scene,"(()=>{const r=document.querySelector('[aria-label=\"Choose bank statement CSV\"]').getBoundingClientRect();return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2,width:innerWidth});})()");
        JSONObject point=new JSONObject(new org.json.JSONTokener(encoded).nextValue().toString());
        AtomicReference<float[]> screen=new AtomicReference<>();CountDownLatch ready=new CountDownLatch(1);
        scene.onActivity(a->{android.webkit.WebView view=a.getBridge().getWebView();int[] origin=new int[2];view.getLocationOnScreen(origin);float scale=(float)(view.getWidth()/point.optDouble("width"));screen.set(new float[]{origin[0]+(float)point.optDouble("x")*scale,origin[1]+(float)point.optDouble("y")*scale});ready.countDown();});
        assertTrue(ready.await(10,TimeUnit.SECONDS));float[] xy=screen.get();
        long now=android.os.SystemClock.uptimeMillis();
        android.view.MotionEvent down=android.view.MotionEvent.obtain(now,now,android.view.MotionEvent.ACTION_DOWN,xy[0],xy[1],0);
        android.view.MotionEvent up=android.view.MotionEvent.obtain(now,now+100,android.view.MotionEvent.ACTION_UP,xy[0],xy[1],0);
        down.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);up.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);
        android.app.UiAutomation automation=InstrumentationRegistry.getInstrumentation().getUiAutomation();
        try { assertTrue(automation.injectInputEvent(down,true));assertTrue(automation.injectInputEvent(up,true)); } finally { down.recycle();up.recycle(); }
    }
    @Test public void productionSessionPersistsAndLogsOutFromSignedRelease() throws Exception {
        String email=InstrumentationRegistry.getArguments().getString("acceptanceEmail","");
        String password=InstrumentationRegistry.getArguments().getString("acceptancePassword","");
        assumeTrue("Requires an explicitly provisioned disposable production account",!email.isEmpty());
        assertTrue(email.matches("release-[0-9a-f-]{36}@example\\.test"));assertFalse(password.isEmpty());
        try(ActivityScenario<MainActivity> scene=ActivityScenario.launch(MainActivity.class)){
            waitFor(scene,"document.querySelector('input[type=email]')","Native sign-in form unavailable");
            input(scene,"input[type=email]",email);input(scene,"input[type=password]",password);button(scene,"Sign in");
            waitFor(scene,"location.pathname==='/dashboard' && document.body.innerText.includes('19.99')","Production statement did not load after native sign-in");
            assertEquals("false",js(scene,"Object.keys(localStorage).some(k=>k.includes('auth-token'))"));
            scene.recreate();
            waitFor(scene,"location.pathname==='/dashboard' && document.body.innerText.includes('19.99')","Secure session was not restored after activity recreation");
            // The dedicated fixture's quota is reset by the operator before this opt-in test.
            // Re-import the same four rows through Android's real picker; no customer data is touched.
            String filename="Casher release acceptance.csv";
            ContentValues values=new ContentValues();values.put(MediaStore.Downloads.DISPLAY_NAME,filename);values.put(MediaStore.Downloads.MIME_TYPE,"text/csv");
            android.content.ContentResolver resolver=InstrumentationRegistry.getInstrumentation().getTargetContext().getContentResolver();
            Uri document=resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,values);assertNotNull(document);
            try {
                try(OutputStream stream=resolver.openOutputStream(document)){
                    assertNotNull(stream);
                    stream.write("Date,Description,Money Out,Money In\n01/09/2026,Release test payroll,,3000.00\n02/09/2026,Release test coffee,4.50,\n02/09/2026,Release test coffee,4.50,\n03/09/2026,Netflix,10.99,\n".getBytes(java.nio.charset.StandardCharsets.UTF_8));
                }
                button(scene,"Upload statement");
                waitFor(scene,"document.querySelector('input[type=file]')","CSV control unavailable");
                js(scene,"document.querySelector('[aria-label=\"Choose bank statement CSV\"]').scrollIntoView({block:'center'})");
                tapFileControl(scene);
                selectDocument(filename);
                waitFor(scene,"document.body.innerText.includes('Casher release acceptance.csv')","Selected document did not return to Casher");
                button(scene,"Analyze Transactions");
                waitFor(scene,"document.body.innerText.includes('Already uploaded')","Native file replay did not reach production import processing");
                waitFor(scene,"!document.querySelector('input[type=file]')","Completed import did not return to the dashboard");
            } finally { resolver.delete(document,null,null); }
            menu(scene);button(scene,"Account");
            waitFor(scene,"location.pathname==='/account' && document.body.innerText.includes("+JSONObject.quote(email)+")","Native account navigation lost the authenticated identity");
            assertEquals("true",js(scene,"Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Export my saved data' && !b.disabled)"));
            button(scene,"Export my saved data");
            File cache=new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getCacheDir(),"exports");
            File[] exports=null;long exportDeadline=System.currentTimeMillis()+25000;
            while(System.currentTimeMillis()<exportDeadline){exports=cache.listFiles((dir,name)->name.endsWith(".json"));if(exports!=null && exports.length==1)break;Thread.sleep(200);}
            assertNotNull("Export cache was not created",exports);assertEquals(1,exports.length);
            JSONObject exported=new JSONObject(new String(Files.readAllBytes(exports[0].toPath()),java.nio.charset.StandardCharsets.UTF_8));
            assertEquals(4,exported.getJSONArray("transactions").length());
            boolean chooser=false;long chooserDeadline=System.currentTimeMillis()+15000;
            while(System.currentTimeMillis()<chooserDeadline){
                AccessibilityNodeInfo root=InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow();
                if(root!=null && root.getPackageName()!=null && root.getPackageName().toString().contains("intentresolver")){chooser=true;break;}
                Thread.sleep(200);
            }
            assertTrue("The OS share sheet did not open",chooser);
            assertTrue(InstrumentationRegistry.getInstrumentation().getUiAutomation().performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK));
            js(scene,"document.querySelector('a[href=\"/dashboard\"]').click()");
            waitFor(scene,"location.pathname==='/dashboard'","Return navigation failed");
            menu(scene);button(scene,"Sign Out");
            waitFor(scene,"location.pathname==='/auth' && document.querySelector('input[type=email]')","Native sign-out did not clear the session");
            scene.recreate();
            waitFor(scene,"location.pathname==='/auth' && document.querySelector('input[type=email]')","Signed-out session returned after restart");
        }
    }
}
