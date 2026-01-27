# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# Keep custom FCM service
-keep class com.fuzztrack.proutapp.ProutMessagingService { *; }

# Keep notification channel initialization classes (critical for EAS AAB builds)
-keep class com.fuzztrack.proutapp.ChannelInitProvider { *; }
-keep class com.fuzztrack.proutapp.NotificationChannelHelper { *; }
-keepclassmembers class com.fuzztrack.proutapp.NotificationChannelHelper {
    *;
}

# Keep ContentProvider for early initialization
-keep class * extends android.content.ContentProvider {
    *;
}

# Prevent R8 from removing raw sound resources (prout1..20.wav)
-keepclassmembers class **.R$raw {
    public static final int prout*;
}
