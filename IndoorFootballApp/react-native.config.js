// Font folders the app ships. The fonts are copied into
// android/app/src/main/assets/fonts/ by hand (no linking package needed on Android).
// assets/fonts holds our own fonts (Barlow Condensed and Inter, with their OFL licenses);
// the vector-icons folder goes away when Lucide replaces it (Task 4.5).
module.exports = {
  assets: ['./node_modules/react-native-vector-icons/Fonts', './assets/fonts'],
};
