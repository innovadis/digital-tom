<template lang="pug">
.flex.flex-justify-center.flex-align-center.full-height.flex-column
  .header
    h1.brand Innovadis
    h3.title Digitale Receptionist Prototype

  .wave-container
    transition(name='fade', mode='in-out')
      wave(:animate='audioPlaying', v-show='audioPlaying')

  transition(name='fade', mode='in-out')
    .message(v-if='currentMessage') {{ currentMessage }}

  .help
    span Dit is een experiment. Er kunnen dingen fout gaan. Wilt u Innovadis zelf bereiken? Bel dan naar #[b 053 850 7500]
    br
    span Gaat er iets fout of heeft u feedback? Laat het ons weten!

  //- .speech
    p(v-for='s in speechHistory') {{ s }}
</template>

<script>
import axios from 'axios'
import Wave from './Wave'

function timeout (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function graphql (query) {
  return axios.post('/graphql', {
    query
  })
}

const GLOBAL_RESET_TIMEOUT = 120 * 1000
const END_RESET_TIMEOUT = 30 * 1000

const ACTION_CALL_RECEPTION = 'reception'

const NAMES = { // TODO from database
  jurgen: {
    speechRecognize: ['jurgen'],
    display: 'Jurgen van Kreij',
    key: 'jurgen'
  },
  christiaan: {
    speechRecognize: ['christiaan'],
    display: 'Christiaan Maks',
    key: 'christiaan'
  },
  martijn: {
    speechRecognize: ['martijn'],
    display: 'Martijn van Tongeren',
    key: 'martijn'
  }
}

// State diagram: https://drive.google.com/open?id=0Bw_SbKcs_eHWbDRXN19TU1pKbVE
const STATES = {
  IDLE: {
    key: 'IDLE',
    message: null,
    hasAudio: false
  },

  AWAIT_REASON: {
    key: 'AWAIT_REASON',
    message: `Welkom bij Innovadis.

Heb je een afspraak of kom je een pakket bezorgen?`,
    validResponses: {
      package: ['pakket', 'pakketje', 'zending', 'brief', 'post', 'pakje', 'levering', 'brengen'], // TODO also from database
      appointment: ['afspraak', 'meeting', 'vergadering', 'bijeenkomst', 'presentatie', 'gesprek', 'kom voor'] // TODO test grammar
    },
    hasAudio: false
  },

  APPOINTMENT_ENTRY: {
    key: 'APPOINTMENT_ENTRY',
    message: 'Heeft u een afspraak met Martijn, Jurgen of iemand anders?',
    validResponses: {
      [NAMES.martijn.key]: NAMES.martijn.speechRecognize,
      [NAMES.jurgen.key]: NAMES.jurgen.speechRecognize,
      [NAMES.christiaan.key]: NAMES.christiaan.speechRecognize,
      other: ['anders']
    }
  },

  CALLING_PERSON: {
    key: 'CALLING_PERSON',
    message: 'Ik ga proberen $0 te bereiken, een moment geduld.'
  },

  CALLING_RECEPTION: {
    key: 'CALLING_RECEPTION',
    message: 'Een moment geduld alstublieft, ik neem contact op met de receptie.' // TODO multiple versions
  },

  CALLING_RECEPTION_RETRY: {
    key: 'CALLING_RECEPTION_RETRY',
    message: 'Helaas wordt er op dit moment niet opgenomen, ik probeer het nog een keer.',
    timeout: 5 * 1000
  },

  CALLING_PERSON_FAILED: {
    key: 'CALLING_PERSON_FAILED',
    message: 'Helaas krijg ik $0 niet te pakken.',
    timeout: 5 * 1000
  },

  CALLING_RECEPTION_FAILED: {
    key: 'CALLING_RECEPTION_FAILED',
    message: 'Helaas wordt de telefoon niet opgenomen.\nU kunt de lift nemen naar verdieping B4 of zelf proberen te bellen naar 053 850 7500',
    timeout: 10 * 1000
  },

  CALLING_SUCCESS: {
    key: 'CALLING_SUCCESS',
    message: 'Gelukt, $0 komt naar beneden.',
    timeout: 10 * 1000
  },

  PACKAGE_ENTRY: {
    key: 'PACKAGE_ENTRY',
    message: 'Moet er nu meteen iemand naar beneden komen, voor bijvoorbeeld een handtekening?',
    validResponses: {
      positive: ['ja', 'graag', 'okay', 'goed', 'yes', 'prima'],
      negative: ['nee', 'niet']
    }
  },

  PACKAGE_NOACTION: {
    key: 'PACKAGE_NOACTION',
    message: `Ik breng Innovadis op de hoogte. U mag het achterlaten op de balie.

      Tot ziens`,
    timeout: 10 * 1000
  },

  END: {
    key: 'END',
    message: `Bedankt voor het gebruiken van de Digitale Receptionist.

      Mocht u op- of aanmerkingen hebben, geef het door aan Innovadis. Bedankt!
      `,
    hasAudio: false
  }
}

export default {
  components: {
    Wave
  },

  data () {
    return {
      speechHistory: [],
      speech: [],
      recognition: null,
      callId: null,
      audioPlaying: false,
      currentMessage: null,
      currentState: null,
      lastRecognizedName: null,
      resetTimeout: null
    }
  },

  methods: {
    log (type, message) {
      const logMessage = `event: "${type}", message: "${message}"`

      console.log('LOG:', logMessage)

      if (process.env.NODE_ENV === 'development') {
        return
      }

      graphql(`
          mutation {
            log(${logMessage})
          }
        `
      )
    },

    init () {
      this.recognition = new webkitSpeechRecognition() // eslint-disable-line
      this.recognition.continuous = true
      this.recognition.lang = 'nl-NL'
      this.recognition.interimResults = true
      this.recognition.maxAlternatives = 1

      this.recognition.onresult = (event) => {
        const allSpeech = new Array(...event.results).map(x => x[0].transcript.toLowerCase().trim())

        this.speech = allSpeech[allSpeech.length - 1]

        this.speechHistory = allSpeech// this.speechHistory.concat(this.speech)

        this.log('speech', this.speech)

        this.processSpeech()
      }

      this.recognition.onspeechstart = (event) => {
        if (this.currentState === STATES.IDLE) {
          this.setState(STATES.AWAIT_REASON)
        }
      }
    },

    playAudio (state) {
      if (state.hasAudio === false) return

      this.audioPlaying = true

      const path = '/static/voice/dewi-' + state.key + '.m4a'

      const audio = new Audio(path)

      audio.play()

      this.stop() // Don't listen to speech while audio is playing because voice recognition will pick up the audio

      audio.onended = () => {
        this.audioPlaying = false

        this.listen()
      }
    },

    async setState (state, replacements) {
      if (!state || !Object.keys(STATES).includes(state.key)) throw new Error('invalid state: ' + state)

      this.currentState = state

      this.log('event', 'state change: ' + state.key)

      let message = state.message

      if (replacements) {
        this.log('debug', 'text replacements: ' + replacements)

        for (let i = 0; i < replacements.length; i++) {
          if (message.includes('$' + i)) {
            message = message.replace('$' + i, replacements[i])
          }
        }
      }

      this.updateMessage(message)

      this.playAudio(state)

      if (state.timeout) {
        await timeout(state.timeout)
      }

      this.delayedReset(GLOBAL_RESET_TIMEOUT) // Wait 2 minutes every time state changes
    },

    updateMessage (message) {
      if (this.currentMessage !== message) {
        this.currentMessage = null

        setTimeout(() => {
          this.currentMessage = message
        }, 0)
      }
    },

    listen () {
      this.recognition.start()

      this.log('event', 'listen started')
    },

    stop () {
      this.recognition.abort()

      this.log('event', 'listen stopped')
    },

    delayedReset (timeout) {
      timeout = timeout || END_RESET_TIMEOUT

      this.log('event', 'delayed reset in ' + timeout + 'ms')

      clearTimeout(this.resetTimeout)

      this.resetTimeout = setTimeout(() => {
        window.location.reload()
      }, timeout)
    },

    async processSpeech () {
      this.delayedReset(GLOBAL_RESET_TIMEOUT)

      switch (this.currentState.key) {
        case STATES.IDLE.key: {
          // responds to any sound from init()

          break
        }

        case STATES.AWAIT_REASON.key: {
          // check for appointment keyword
          if (STATES[this.currentState.key].validResponses.appointment.some(
            keyword =>
              this.speech.includes(keyword)
          )) {
            this.setState(STATES.APPOINTMENT_ENTRY)
            break
          }

          // check for package keyword
          if (STATES[this.currentState.key].validResponses.package.some(
            keyword =>
              this.speech.includes(keyword)
          )) {
            this.setState(STATES.PACKAGE_ENTRY)
            break
          }

          // easter egg
          if (this.speech.includes('goede muziek')) {
            // TODO
          }
          break
        }

        case STATES.APPOINTMENT_ENTRY.key: {
          // check for supported names
          const names = Object.keys(STATES[this.currentState.key].validResponses)

          const nameIndex = names.findIndex(
            name =>
              STATES[this.currentState.key].validResponses[name].some(
                triggerWord =>
                  this.speech.includes(triggerWord)
              )
          )

          const name = names[nameIndex]

          // check for other person keyword
          if (name === 'other') {
            this.setState(STATES.CALLING_RECEPTION)

            this.stop()

            this.call(ACTION_CALL_RECEPTION)

            break
          } else if (name) {
            this.lastRecognizedName = NAMES[name]

            this.setState(STATES.CALLING_PERSON, [this.lastRecognizedName.display])

            this.stop()

            this.call(this.lastRecognizedName.key)
          }
          break
        }

        case STATES.PACKAGE_ENTRY.key: {
          // check for positive ack
          if (STATES[this.currentState.key].validResponses.positive.some(
            keyword =>
              this.speech.includes(keyword)
          )) {
            this.setState(STATES.CALLING_RECEPTION)

            this.stop()

            this.call(ACTION_CALL_RECEPTION)
          } else if (STATES[this.currentState.key].validResponses.negative.some( // check for negative ack
            keyword =>
              this.speech.includes(keyword)
          )) {
            this.setState(STATES.PACKAGE_NOACTION)

            this.stop()

            await graphql(`
                mutation {
                  notification(type: "package")
                }
              `
            )

            await timeout(10 * 1000)

            this.setState(STATES.END)

            this.delayedReset()
          }

          break
        }

        default:
          throw new Error('unknown state or should not be listening during this state: ' + this.currentState.key)
      }
    },

    async call (target, nextAction) {
      this.log('event', 'placing call to ' + target)

      const callRes = await graphql(`
        mutation {
          call(name: "${target}") {
            callSid,
            status
          }
        }
      `)

      const callSid = callRes.data.data.call.callSid

      const POLL_PERIOD = 5000
      let callStatus = callRes.data.data.call.status
      let msElapsed = 0

      while (callStatus === 'in progress' && msElapsed < 60 * 1000) {
        await timeout(POLL_PERIOD)
        msElapsed += POLL_PERIOD

        const statusRes = await graphql(`
          query {
            status(callSid: "${callSid}") {
              status
            }
          }
        `)

        callStatus = statusRes.data.data.status.status

        this.log('event', `got call status for sid ${callSid} with status: ${callStatus}`)
      }

      if (callStatus === 'busy') {
        if (this.currentState === STATES.CALLING_PERSON) {
          await this.setState(STATES.CALLING_PERSON_FAILED, [this.lastRecognizedName.display])

          await this.setState(STATES.CALLING_RECEPTION)

          this.call(ACTION_CALL_RECEPTION)
        } else if (this.currentState === STATES.CALLING_RECEPTION) {
          await this.setState(STATES.CALLING_RECEPTION_RETRY)

          this.call(ACTION_CALL_RECEPTION)
        } else if (this.currentState === STATES.CALLING_RECEPTION_RETRY) {
          await this.setState(STATES.CALLING_RECEPTION_FAILED)

          // send a slack notification here that digitaltom tried calling but no one answered
          await graphql(`
              mutation {
                notification(type: "no answer")
              }
            `
          )

          await this.setState(STATES.END)

          this.delayedReset()
        }
      } else if (callStatus === 'completed') {
        if (this.currentState === STATES.CALLING_PERSON) {
          await this.setState(STATES.CALLING_SUCCESS, [this.lastRecognizedName.display])
        } else if (this.currentState === STATES.CALLING_RECEPTION) {
          await this.setState(STATES.CALLING_SUCCESS, 'een collega')
        } else if (this.currentState === STATES.CALLING_RECEPTION_RETRY) {
          await this.setState(STATES.CALLING_SUCCESS, 'een collega')
        }

        await timeout(10000)

        await this.setState(STATES.END)

        this.delayedReset()
      } else {
        throw new Error('call status nyi: ' + callStatus)
      }
    }
  },

  mounted () {
    this.setState(STATES.IDLE)

    this.init()

    this.listen()
  }
}
</script>

<style lang="scss" scoped>
@import "src/styles/variables";

.header {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: absolute;
  top: 0;

  .brand {
    color: white;
    font-size: 80px;
    margin: 40px 0 0 0;

    &:after {
      content: ".";
      color: $inno-yellow;
    }
  }

  .title {
    color: white;
    font-size: 32px;
  }
}

.help {
  position: absolute;
  bottom: 5px;
  left: 5px;

  b,
  span {
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
  }
}

.message {
  color: white;
  white-space: pre-line;
  text-align: center;
  max-width: 75%;
  font-size: 30px;
}

.speech {
  position: absolute;
  bottom: 0;

  &:after {
    content: "";
    height: 200px;
    width: 100%;
    background: linear-gradient(
      to bottom,
      $inno-blue-dark 30%,
      transparent 50%
    );
    position: absolute;
    bottom: 0;
    left: 0;
  }

  p {
    color: white;
    font-size: 20px;
    text-align: center;
    transition: all 0.2s ease-in-out;
    height: 10px;

    @for $i from 1 through 100 {
      &:nth-last-child(n + #{$i}) {
        opacity: 1 - 0.2 * $i;
        transform-origin: 50% 100%;
        transform: perspective(100px) rotateX(25deg) scale(0.8);
      }

      &:last-child {
        opacity: 1;
        transform: none;
        font-size: 30px;
        line-height: 14px;
      }
    }
  }
}

.wave-container {
  display: flex;
  justify-content: center;
  height: 60px;
}
</style>
