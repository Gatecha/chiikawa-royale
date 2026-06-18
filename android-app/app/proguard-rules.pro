-keepattributes EnclosingMethod,InnerClasses,Signature
-keepattributes *Annotation*
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}