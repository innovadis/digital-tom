<template>
  <div id="app">
    <router-view></router-view>
  </div>
</template>

<script>
export default {
  name: 'app',

  mounted() {
    // bubbly({
    //   blur: 2,
    //   colorStart: '#0029a8',
    //   colorStop: '#1a001a',
    //   shadowColor: '#000'
    // })
  }
}
</script>

<style lang="scss">
@import 'src/styles/layout';
@import 'src/styles/transition';
@import 'src/styles/fonts';
@import 'src/styles/variables';

body {
  margin: 0;
  background: $inno-blue-dark;
}

#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  height: 100vh;
}
</style>
