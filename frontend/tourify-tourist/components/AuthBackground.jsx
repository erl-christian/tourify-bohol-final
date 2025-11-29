import { LinearGradient } from 'expo-linear-gradient';
import { ImageBackground, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';

export default function AuthBackground({ children }) {
  return (
    <LinearGradient colors={[colors.primary, colors.accent]} style={styles.root}>
      <ImageBackground
        source={require('../assets/auth-hero.jpg')} // add a soft illustration
        resizeMode="cover"
        style={styles.image}
        imageStyle={{ opacity: 0.15 }}
      >
        {children}
      </ImageBackground>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  image: { flex: 1, paddingHorizontal: 24, paddingVertical: 32 },
});
