<template lang="pug">
div
  h3 Say something already

  button(@click='stop', v-if='stream && stream.active') stop
  button(@click='start', v-else) Click to start talking

  h3 You said

  p {{ speech }}

</template>

<script>
// import axios from 'axios'
const websocket = require('websocket-stream')

export default {
  data() {
    return {
      speech: null,
      stream: null
    }
  },

  methods: {
    async start() {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      const ws = websocket('ws://localhost:3000/api/transcribe')

      ws.pipe(this.stream)
      // ws.pipe(this.stream.getTracks()[0])
    },

    stop() {
      this.stream.getTracks()[0].stop()

      console.log(this.stream)



      // const res = await axios.get('http://localhost:3000/api/transcribe', {

      // })

      // this.speech = res.data
    },

    async transcribe() {


    }
  }
}
</script>

<style lang="scss" scoped>

</style>
