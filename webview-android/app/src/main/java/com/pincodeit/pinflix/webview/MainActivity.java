package com.pincodeit.pinflix.webview;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Locale;

public final class MainActivity extends Activity {
    private static final String HOME = BuildConfig.PINFLIX_WEB_URL;
    private WebView browser;
    private FrameLayout frame;
    private LinearLayout errorView;
    private ProgressBar loadingBar;
    private View fullScreenView;
    private WebChromeClient.CustomViewCallback fullScreenCallback;
    private int priorOrientation;
    private boolean mainFrameFailed;

    private static boolean isWebHost(String host) {
        return "pinflix-apk.pincodeit.com".equals(host);
    }

    private static boolean canUseHttp(Uri uri) {
        if (!"http".equalsIgnoreCase(uri.getScheme())) return true;
        String host = uri.getHost();
        if (host == null || uri.getUserInfo() != null) return false;
        host = host.toLowerCase(Locale.ROOT);
        int port = uri.getPort();
        if ("cineplexbd.net".equals(host) || "cds3.cineplexbd.net".equals(host)
                ) return port == -1 || port == 80;
        if ("vod.cineplexbd.net".equals(host)) return port == 8081;
        if ("103.136.200.124".equals(host)) return port == 8081 || port == 8086;
        return false;
    }

    private static boolean isInternal(Uri uri) {
        if (uri == null || uri.getHost() == null || uri.getUserInfo() != null) return false;
        String scheme = uri.getScheme();
        int port = uri.getPort();
        return isWebHost(uri.getHost().toLowerCase(Locale.ROOT)) &&
            (("https".equalsIgnoreCase(scheme) && (port == -1 || port == 443)) ||
             ("http".equalsIgnoreCase(scheme) && canUseHttp(uri)));
    }

    @Override public void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        getWindow().setStatusBarColor(Color.rgb(9,14,25));
        getWindow().setNavigationBarColor(Color.rgb(9,14,25));
        frame = new FrameLayout(this);
        browser = new WebView(this);
        browser.setBackgroundColor(Color.rgb(9,14,25));
        browser.setOverScrollMode(View.OVER_SCROLL_NEVER);
        browser.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);

        WebSettings settings = browser.getSettings();
        settings.setJavaScriptEnabled(true); // Next.js needs JS.
        settings.setDomStorageEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setTextZoom(100);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setSupportMultipleWindows(false);
        // Required only where HTTPS web playback references HTTP media.
        // The interception and network XML below restrict cleartext hosts.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        // Reset stale pre-fix placeholder HTML once after upgrading to 1.4.
        if(getSharedPreferences("pinflix_webview",MODE_PRIVATE).getInt("cache_schema",0)<14) {
            browser.clearCache(true);
            getSharedPreferences("pinflix_webview",MODE_PRIVATE).edit().putInt("cache_schema",14).apply();
        }
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(browser,false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        browser.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                if (!req.isForMainFrame()) return false;
                Uri url = req.getUrl();
                if (isInternal(url)) return false;
                String scheme = url.getScheme();
                if ("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme)) {
                    try {startActivity(new Intent(Intent.ACTION_VIEW,url));} catch (Exception ignored) {}
                }
                return true;
            }

            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri url = req.getUrl();
                if ("http".equalsIgnoreCase(url.getScheme()) && !canUseHttp(url)) {
                    return new WebResourceResponse("text/plain","UTF-8",403,"Unapproved HTTP source",
                        Collections.singletonMap("Cache-Control","no-store"),
                        new ByteArrayInputStream("Blocked unapproved HTTP resource".getBytes(StandardCharsets.UTF_8)));
                }
                return null;
            }

            @Override public void onPageStarted(WebView view, String url, Bitmap favicon) {
                mainFrameFailed=false;
                if(loadingBar!=null){loadingBar.setVisibility(View.VISIBLE);loadingBar.setProgress(8);}
                showError(false);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if(request.isForMainFrame()) {mainFrameFailed=true;showError(true);}
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse resp) {
                if(request.isForMainFrame() && resp.getStatusCode() >= 400) {
                    mainFrameFailed=true;showError(true);
                }
            }
            @Override public void onPageFinished(WebView view, String url) {
                if(loadingBar!=null)loadingBar.setVisibility(View.GONE);
                if(!mainFrameFailed) showError(false);
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel(); // No certificate-error bypass.
            }
        });

        browser.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view,int progress) {
                if(loadingBar!=null){loadingBar.setProgress(progress);loadingBar.setVisibility(progress>=100?View.GONE:View.VISIBLE);}
            }
            @Override public void onShowCustomView(View view, CustomViewCallback callback) {
                if(fullScreenView!=null) {callback.onCustomViewHidden();return;}
                priorOrientation=getRequestedOrientation();
                fullScreenView=view;
                fullScreenCallback=callback;
                browser.setVisibility(View.GONE);
                if(loadingBar!=null)loadingBar.setVisibility(View.GONE);
                frame.addView(view,new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
                getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                    WindowManager.LayoutParams.FLAG_FULLSCREEN);
                getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN |
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
            }
            @Override public void onHideCustomView() {leaveFullscreen();}
            @Override public void onPermissionRequest(PermissionRequest req) {
                runOnUiThread(req::deny); // No silent camera/microphone grants.
            }
        });

        frame.addView(browser,new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
        loadingBar=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);
        loadingBar.setIndeterminate(false);
        loadingBar.setMax(100);
        FrameLayout.LayoutParams progressParams=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
            (int)(3*getResources().getDisplayMetrics().density),Gravity.TOP);
        frame.addView(loadingBar,progressParams);

        errorView=new LinearLayout(this);
        errorView.setOrientation(LinearLayout.VERTICAL);
        errorView.setGravity(Gravity.CENTER);
        errorView.setBackgroundColor(Color.rgb(9,14,25));
        int pad=(int)(24*getResources().getDisplayMetrics().density);
        errorView.setPadding(pad,pad,pad,pad);
        TextView message=new TextView(this);
        message.setText(R.string.offline_message);
        message.setTextColor(Color.WHITE);
        message.setTextSize(17);
        message.setGravity(Gravity.CENTER);
        Button retry=new Button(this);
        retry.setText(R.string.retry);
        retry.setOnClickListener(v->{mainFrameFailed=false;showError(false);browser.loadUrl(HOME);});
        errorView.addView(message);
        errorView.addView(retry);
        errorView.setVisibility(View.GONE);
        frame.addView(errorView,new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(frame);

        if(savedState==null) browser.loadUrl(HOME);
        else {
            browser.restoreState(savedState);
            if(browser.getUrl()==null) browser.loadUrl(HOME);
        }
    }

    private void showError(boolean visible) {
        if(errorView!=null)errorView.setVisibility(visible?View.VISIBLE:View.GONE);
        if(visible && loadingBar!=null)loadingBar.setVisibility(View.GONE);
    }

    private void leaveFullscreen() {
        if(fullScreenView==null)return;
        frame.removeView(fullScreenView);
        fullScreenView=null;
        WebChromeClient.CustomViewCallback cb=fullScreenCallback;
        fullScreenCallback=null;
        if(cb!=null)cb.onCustomViewHidden();
        browser.setVisibility(View.VISIBLE);
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        setRequestedOrientation(priorOrientation);
    }

    @Override public void onBackPressed() {
        if(fullScreenView!=null){leaveFullscreen();return;}
        if(browser.canGoBack()){browser.goBack();return;}
        String current=browser.getUrl();
        if(current!=null && !current.equals(HOME)){browser.loadUrl(HOME);return;}
        new AlertDialog.Builder(this).setTitle("Exit PinFlix?")
            .setMessage("Do you want to close PinFlix?")
            .setNegativeButton("Stay",(d,w)->d.dismiss())
            .setPositiveButton("Exit",(d,w)->finish()).show();
    }

    @Override public void onSaveInstanceState(Bundle state) {
        if(browser!=null)browser.saveState(state);
        super.onSaveInstanceState(state);
    }

    @Override protected void onDestroy() {
        if(fullScreenView!=null)leaveFullscreen();
        if(browser!=null) {
            browser.stopLoading();
            browser.setWebChromeClient(null);
            browser.setWebViewClient(null);
            frame.removeView(browser);
            browser.destroy();
            browser=null;
        }
        super.onDestroy();
    }
}
