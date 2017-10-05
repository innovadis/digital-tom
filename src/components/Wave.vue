<template lang="pug">
.siri(ref='siri')
</template>

<script>
export default {
  props: {
    animate: Boolean
  },

  data() {
    return {
      siri: null
    }
  },

  mounted() {
    this.siri = new SiriWave9({
      container: this.$refs.siri,
      width: 259,
      height: 40,
      speed: 0.2,
      style: 'ios9',
      color: '#f00',
      autostart: false
    })

    // this.siri.start()
  },

  destroyed() {
    this.siri.stop()
  },

  watch: {
    animate(v) {
      if (v) {
        this.siri.start()
      } else {
        this.siri.stop()
      }
    }
  }
}
</script>

<style lang="scss" scoped>
@import 'src/styles/variables';

.siri {
  // background: ;
}
</style>
