package io.ionic.starter;

import android.annotation.SuppressLint;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.util.TypedValue;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.core.view.WindowInsetsCompat;

import java.util.ArrayDeque;
import java.util.Deque;

public class GatekeeperActivity extends AppCompatActivity {

    private static final String BASE_URL = "https://www.instagram.com";
    private static final String PREFS_NAME = "instagram_gatekeeper";
    private static final String PREF_LAST_ALLOWED_PATH = "last_allowed_path";

    private static final String PATH_LOGIN = "/accounts/login/";
    private static final String PATH_DIRECT = "/direct/";
    private static final String PATH_POST = "/p/";
    private static final String PATH_SETTINGS = "/accounts/settings/";

    private WebView webView;
    private FrameLayout rootLayout;
    private View topSpacer;
    private String currentAllowedPath = PATH_DIRECT;
    private boolean internalRedirectInProgress = false;
    private final Deque<String> allowedHistory = new ArrayDeque<>();
    private String forcedTargetPath = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        configureSystemBars();
        setupRootLayout();
        webView = new WebView(this);
        attachWebViewWithSafeTopInset();

        configureBackBehavior();
        configureWebView();

        // Always start at /direct/. If user is not logged in, Instagram sends them to /accounts/login/.
        openPath(PATH_DIRECT);
    }

    private void setupRootLayout() {
        rootLayout = new FrameLayout(this);
        rootLayout.setLayoutParams(new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        topSpacer = new View(this);
        topSpacer.setBackgroundColor(0xFF000000);
        rootLayout.addView(topSpacer);

        setContentView(rootLayout);
    }

    private void attachWebViewWithSafeTopInset() {
        int safeTopInset = calculateSafeTopInset();

        FrameLayout.LayoutParams spacerParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                safeTopInset
        );
        topSpacer.setLayoutParams(spacerParams);

        FrameLayout.LayoutParams webParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        );
        webParams.topMargin = safeTopInset;
        webView.setLayoutParams(webParams);

        rootLayout.addView(webView);
    }

    private void configureSystemBars() {
        // Force non-fullscreen behavior across OEM skins (including Xiaomi/MIUI).
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attrs = getWindow().getAttributes();
            attrs.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_NEVER;
            getWindow().setAttributes(attrs);
        }

        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.show(WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.navigationBars());
        }
    }

    private int calculateSafeTopInset() {
        int statusBar = getStatusBarHeight();
        int baseInset = Math.max(statusBar, dpToPx(28));

        // Xiaomi devices often under-report or ignore inset handling; add extra offset.
        if (Build.MANUFACTURER != null && Build.MANUFACTURER.equalsIgnoreCase("Xiaomi")) {
            return Math.max(baseInset + dpToPx(10), dpToPx(38));
        }

        return baseInset;
    }

    private int getStatusBarHeight() {
        int resourceId = getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (resourceId > 0) {
            return getResources().getDimensionPixelSize(resourceId);
        }
        return 0;
    }

    private int dpToPx(int dp) {
        return (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP,
                dp,
                getResources().getDisplayMetrics()
        );
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccess(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        webView.addJavascriptInterface(new GatekeeperJsBridge(), "GatekeeperBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                return enforceOrAllow(uri != null ? uri.toString() : "", true);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return enforceOrAllow(url, true);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                enforceOrAllow(url, false);
                injectRouteObserver();
            }
        });
    }

    private void configureBackBehavior() {
        // Native back should return to previous allowed route only.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                handleNativeBack();
            }
        });
    }

    private void handleNativeBack() {
        if (allowedHistory.size() <= 1) {
            return;
        }

        // Remove current path and go to the previous allowed one.
        allowedHistory.pollLast();
        String previous = allowedHistory.peekLast();
        if (previous == null) {
            previous = PATH_DIRECT;
        }

        internalRedirectInProgress = true;
        updateCurrentAllowedPath(previous, false);
        String target = previous;

        webView.post(() -> {
            webView.loadUrl(BASE_URL + target);
            internalRedirectInProgress = false;
        });
    }

    private boolean enforceOrAllow(String fullUrl, boolean fromOverride) {
        ParsedUrl parsed = parseUrl(fullUrl);

        if (parsed == null) {
            String target = getRedirectTarget(currentAllowedPath);
            forcedTargetPath = normalizeForOpen(target);
            redirectTo(forcedTargetPath);
            return true;
        }

        boolean hostAllowed = "instagram.com".equals(parsed.host) || "www.instagram.com".equals(parsed.host);
        boolean pathAllowed = isAllowedPath(parsed.path);
        String normalizedCandidate = normalizeForOpen(parsed.path);

        if (forcedTargetPath != null) {
            if (normalizedCandidate.equals(forcedTargetPath)) {
                // Forced navigation reached; unlock.
                forcedTargetPath = null;
            } else {
                // Ignore intermediate hops and keep forcing the chosen target.
                redirectTo(forcedTargetPath);
                return true;
            }
        }

        if (hostAllowed && pathAllowed) {
            updateCurrentAllowedPath(normalizedCandidate, true);
            return false;
        }

        String target = getRedirectTarget(currentAllowedPath);
        forcedTargetPath = normalizeForOpen(target);
        redirectTo(forcedTargetPath);
        return true;
    }

    private void redirectTo(String targetPath) {
        if (internalRedirectInProgress) {
            return;
        }

        internalRedirectInProgress = true;
        String normalized = normalizeForOpen(targetPath);
        updateCurrentAllowedPath(normalized, true);

        webView.post(() -> {
            webView.loadUrl(BASE_URL + normalized);
            internalRedirectInProgress = false;
        });
    }

    private void openPath(String path) {
        String normalized = normalizeForOpen(path);
        allowedHistory.clear();
        updateCurrentAllowedPath(normalized, true);
        webView.loadUrl(BASE_URL + normalized);
    }

    private void updateCurrentAllowedPath(String path, boolean pushHistory) {
        String normalized = normalizeForOpen(path);
        currentAllowedPath = normalized;
        persistLastAllowedPath(normalized);

        if (!pushHistory) {
            return;
        }

        String last = allowedHistory.peekLast();
        if (last == null || !last.equals(normalized)) {
            allowedHistory.addLast(normalized);
        }
    }

    private void injectRouteObserver() {
        String script = "(function(){"
                + "if(window.__gatekeeperObserverInstalled){return;}"
                + "window.__gatekeeperObserverInstalled=true;"
                + "function send(){try{window.GatekeeperBridge.reportLocation(window.location.href);}catch(e){}}"
                + "var push=history.pushState;"
                + "history.pushState=function(){var r=push.apply(this,arguments);setTimeout(send,0);return r;};"
                + "var replace=history.replaceState;"
                + "history.replaceState=function(){var r=replace.apply(this,arguments);setTimeout(send,0);return r;};"
                + "window.addEventListener('popstate',send,true);"
                + "window.addEventListener('hashchange',send,true);"
                + "document.addEventListener('click',function(){setTimeout(send,0);},true);"
                + "setInterval(send,250);"
                + "send();"
                + "})();";

        webView.evaluateJavascript(script, null);
    }

    private boolean isAllowedPath(String path) {
        String lower = normalizeForCheck(path).toLowerCase();
        return lower.equals(PATH_LOGIN)
                || lower.startsWith(PATH_LOGIN)
                || lower.equals(PATH_DIRECT)
                || lower.startsWith(PATH_DIRECT)
                || lower.equals(PATH_SETTINGS)
                || lower.startsWith(PATH_SETTINGS)
                || lower.startsWith(PATH_POST);
    }

    private String getRedirectTarget(String currentPath) {
        String lower = normalizeForCheck(currentPath).toLowerCase();
        if (lower.startsWith(PATH_DIRECT)) {
            return PATH_SETTINGS;
        }
        if (lower.startsWith(PATH_SETTINGS)) {
            return PATH_DIRECT;
        }

        // For /p/... or other allowed routes, return the previous allowed page when possible.
        if (allowedHistory.size() >= 2) {
            String[] entries = allowedHistory.toArray(new String[0]);
            String previous = entries[entries.length - 2];
            if (previous != null && !previous.isEmpty()) {
                return normalizeForOpen(previous);
            }
        }

        return PATH_DIRECT;
    }

    private String normalizeForCheck(String path) {
        String out = path == null ? "/" : path.trim();
        if (out.isEmpty()) {
            out = "/";
        }
        if (!out.startsWith("/")) {
            out = "/" + out;
        }

        int q = out.indexOf('?');
        if (q >= 0) {
            out = out.substring(0, q);
        }
        int h = out.indexOf('#');
        if (h >= 0) {
            out = out.substring(0, h);
        }

        return out.isEmpty() ? "/" : out;
    }

    private String normalizeForOpen(String path) {
        String checked = normalizeForCheck(path);

        if ("/".equals(checked)) {
            return PATH_DIRECT;
        }
        if ("/direct".equalsIgnoreCase(checked)) {
            return PATH_DIRECT;
        }
        if ("/accounts/settings".equalsIgnoreCase(checked)) {
            return PATH_SETTINGS;
        }
        if ("/accounts/login".equalsIgnoreCase(checked)) {
            return PATH_LOGIN;
        }
        if ("/p".equalsIgnoreCase(checked)) {
            return PATH_POST;
        }

        return checked;
    }

    private ParsedUrl parseUrl(String fullUrl) {
        try {
            Uri uri = Uri.parse(fullUrl);
            String host = uri.getHost();
            if (host == null) {
                return null;
            }
            String path = uri.getPath();
            if (path == null || path.isEmpty()) {
                path = "/";
            }
            return new ParsedUrl(host.toLowerCase(), path);
        } catch (Exception ex) {
            return null;
        }
    }

    private void persistLastAllowedPath(String path) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        prefs.edit().putString(PREF_LAST_ALLOWED_PATH, normalizeForOpen(path)).apply();
    }

    private static final class ParsedUrl {
        final String host;
        final String path;

        ParsedUrl(String host, String path) {
            this.host = host;
            this.path = path;
        }
    }

    private final class GatekeeperJsBridge {
        @JavascriptInterface
        public void reportLocation(String fullUrl) {
            runOnUiThread(() -> enforceOrAllow(fullUrl, false));
        }
    }
}
