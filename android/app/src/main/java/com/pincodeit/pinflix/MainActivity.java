package com.pincodeit.pinflix;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.res.ColorStateList;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.window.OnBackInvokedDispatcher;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

public class MainActivity extends Activity {
    private static final String HOME = "https://pinflix.pincodeit.com/";
    private static final String TRUSTED_HOST = "pinflix.pincodeit.com";

    private WebView webView;
    private FrameLayout root;
    private FrameLayout videoFullscreenContainer;
    private LinearLayout errorOverlay;
    private ProgressBar loadingBar;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private int previousOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;
    private boolean mainFrameError = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(16, 19, 31));
        getWindow().setNavigationBarColor(Color.rgb(16, 19, 31));

        root = new FrameLayout(this);
        root.setFitsSystemWindows(true);
        root.setBackgroundColor(Color.rgb(16, 19, 31));
        setContentView(root);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(16, 19, 31));
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));

        videoFullscreenContainer = new FrameLayout(this);
        videoFullscreenContainer.setBackgroundColor(Color.BLACK);
        videoFullscreenContainer.setVisibility(View.GONE);
        root.addView(videoFullscreenContainer, new FrameLayout.LayoutParams(-1, -1));

        buildErrorOverlay();

        loadingBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        loadingBar.setIndeterminate(false);
        loadingBar.setProgressTintList(ColorStateList.valueOf(Color.rgb(151, 165, 255)));
        FrameLayout.LayoutParams progressLayout = new FrameLayout.LayoutParams(-1, dp(3), Gravity.TOP);
        root.addView(loadingBar, progressLayout);
        loadingBar.setMax(100);
        loadingBar.setVisibility(View.GONE);

        configureWebView();
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                this::handleBack
            );
        }

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
            if (webView.getUrl() == null) openHome();
        } else {
            openHome();
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private TextView label(String text, int size, int color) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextColor(color);
        view.setTextSize(size);
        view.setGravity(Gravity.CENTER);
        return view;
    }

    private void buildErrorOverlay() {
        errorOverlay = new LinearLayout(this);
        errorOverlay.setOrientation(LinearLayout.VERTICAL);
        errorOverlay.setGravity(Gravity.CENTER);
        errorOverlay.setPadding(dp(26), dp(20), dp(26), dp(20));
        errorOverlay.setBackgroundColor(Color.rgb(16, 19, 31));
        errorOverlay.setVisibility(View.GONE);

        TextView brand = label("PinFlix", 35, Color.rgb(159, 172, 255));
        errorOverlay.addView(brand, new LinearLayout.LayoutParams(-1, dp(60)));

        TextView title = label("Connection unavailable", 23, Color.WHITE);
        errorOverlay.addView(title, new LinearLayout.LayoutParams(-1, dp(65)));

        TextView desc = label(
            "Check your internet connection and try again. This app loads the PinFlix website.",
            15, Color.rgb(185, 192, 214)
        );
        LinearLayout.LayoutParams descParams = new LinearLayout.LayoutParams(-1, -2);
        descParams.bottomMargin = dp(25);
        errorOverlay.addView(desc, descParams);

        Button retry = new Button(this);
        retry.setText("Retry");
        retry.setTextColor(Color.WHITE);
        retry.setAllCaps(false);
        retry.setBackgroundTintList(ColorStateList.valueOf(Color.rgb(80, 91, 185)));
        retry.setOnClickListener(v -> openHome());
        errorOverlay.addView(retry, new LinearLayout.LayoutParams(dp(170), dp(54)));

        root.addView(errorOverlay, new FrameLayout.LayoutParams(-1, -1));
    }

    private boolean isTrustedUrl(Uri uri) {
        return "https".equalsIgnoreCase(uri.getScheme())
            && TRUSTED_HOST.equalsIgnoreCase(uri.getHost())
            && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    private void openExternal(Uri uri) {
        String scheme = uri.getScheme();
        if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) return;
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        try {
            startActivity(intent);
        } catch (ActivityNotFoundException ignored) {
            // No compatible browser installed.
        }
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);
        settings.setLoadsImagesAutomatically(true);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Subframe navigations can be required by embedded playback providers.
                if (!request.isForMainFrame()) return false;
                Uri uri = request.getUrl();
                if (isTrustedUrl(uri)) return false;
                openExternal(uri);
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                mainFrameError = false;
                errorOverlay.setVisibility(View.GONE);
                loadingBar.setProgress(0);
                loadingBar.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                loadingBar.setVisibility(View.GONE);
                if (!mainFrameError) errorOverlay.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    mainFrameError = true;
                    errorOverlay.setVisibility(View.VISIBLE);
                    loadingBar.setVisibility(View.GONE);
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int progress) {
                loadingBar.setProgress(progress);
                if (progress >= 100) loadingBar.setVisibility(View.GONE);
            }

            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                fullscreenView = view;
                fullscreenCallback = callback;
                previousOrientation = getRequestedOrientation();
                videoFullscreenContainer.addView(view, new FrameLayout.LayoutParams(-1, -1));
                videoFullscreenContainer.setVisibility(View.VISIBLE);
                loadingBar.setVisibility(View.GONE);
                errorOverlay.setVisibility(View.GONE);
                getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
                getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
            }

            @Override
            public void onHideCustomView() {
                closeFullscreenVideo();
            }
        });

        // Avoid acquiring storage permissions or silently downloading provider media.
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, length) -> {
            try {
                openExternal(Uri.parse(url));
            } catch (IllegalArgumentException ignored) {}
        });
    }

    private void closeFullscreenVideo() {
        if (fullscreenView == null) return;
        videoFullscreenContainer.removeView(fullscreenView);
        fullscreenView = null;
        videoFullscreenContainer.setVisibility(View.GONE);
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setRequestedOrientation(previousOrientation);
        if (fullscreenCallback != null) {
            WebChromeClient.CustomViewCallback callback = fullscreenCallback;
            fullscreenCallback = null;
            callback.onCustomViewHidden();
        }
    }

    private void openHome() {
        mainFrameError = false;
        errorOverlay.setVisibility(View.GONE);
        webView.loadUrl(HOME);
    }

    private void handleBack() {
        if (fullscreenView != null) {
            closeFullscreenVideo();
        } else if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            finish();
        }
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (Build.VERSION.SDK_INT < 33) handleBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onDestroy() {
        closeFullscreenVideo();
        if (webView != null) {
            root.removeView(webView);
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
