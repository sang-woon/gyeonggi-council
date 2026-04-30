# ProGuard / R8 규칙 — 경기도의회 HWP 뷰어
# Capacitor + WebView + WASM 기반 앱

# 디버그 정보 보존 (크래시 분석용)
-keepattributes SourceFile,LineNumberTable
-keepattributes *Annotation*

# Capacitor 관련 클래스 보존
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.annotation.PluginMethod *;
}

# WebView JavaScript 인터페이스 보존
-keepclassmembers class kr.go.gg.council.hwp.** {
    @android.webkit.JavascriptInterface *;
}

# Cordova plugins (Capacitor가 내부적으로 사용)
-keep class org.apache.cordova.** { *; }
-keep class * extends org.apache.cordova.CordovaPlugin

# AndroidX
-keep class androidx.** { *; }
-keep interface androidx.** { *; }

# Splash screen
-keep class androidx.core.splashscreen.** { *; }

# WASM 자체는 native이라 별도 ProGuard 영향 없음
# WebView 내부에서 로드되는 JS는 이미 Vite 빌드에서 minified
