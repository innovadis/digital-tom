<template lang="pug">
.flex.flex-justify-center.flex-align-center.full-height.flex-column
  .header
    h1.brand Innovadis
    h3.title Digitale Receptionist

  .wave-container
    transition(name='fade', mode='in-out')
      wave(:animate='animateSiri', v-show='animateSiri')

  transition(name='fade', mode='in-out')
    .message(v-if='currentMessage') {{ currentMessage }}

  .speech
    p(v-for='s in speechHistory') {{ s }}
</template>

<script>
  import axios from 'axios'
  import Wave from './Wave'

  const RESET_TIMEOUT = 30 * 1000

  const NAMES = {
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
      message: null
    },

    AWAIT_INPUT: {
      key: 'AWAIT_INPUT',
      message: `Hallo, kom je voor Innovadis? Dan help ik je graag.`,
      validResponses: {
        positive: ['ja']
      }
    },

    AWAIT_REASON: {
      key: 'AWAIT_REASON',
      message: 'Waarvoor komt u?',
      validResponses: {
        package: ['pakket', 'pakketje', 'zending', 'brief', 'post', 'pakje', 'levering', 'brengen'],
        appointment: ['afspraak', 'meeting', 'vergadering', 'bijeenkomst', 'presentatie', 'gesprek'] // TODO test grammar
      }
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
      // audioPath: '/static/voice/christiaan_afspraakmetwie.m4a'
    },

    CALLING_PERSON: {
      key: 'CALLING_PERSON',
      message: 'Een moment geduld. Ik ben Martijn/Jurgen op.' // TODO variable
    },

    CALLING_RECEPTION: {
      key: 'CALLING_RECEPTION',
      message: 'Een moment geduld aub, ik bel de receptie.' // TODO multiple versions
    },

    CALLING_RECEPTION_RETRY: {
      key: 'CALLING_RECEPTION_RETRY',
      message: 'Helaas wordt er op dit moment niet opgenomen, ik probeer het nog een keer.'
    },

    CALLING_PERSON_FAILED: {
      key: 'CALLING_PERSON_FAILED',
      message: 'Helaas krijg ik Jurgen/Martijn niet te pakken, ik bel nu de receptie.'
    },

    CALLING_RECEPTION_FAILED: {
      key: 'CALLING_RECEPTION_FAILED',
      message: 'Helaas wordt de telefoon niet opgenomen, u kunt de lift nemen naar verdieping B4 of zelf proberen te bellen naar 053 850 7500'
    },

    CALLING_SUCCESS: {
      key: 'CALLING_SUCCESS',
      message: 'Gelukt, er komt iemand naar beneden.' // TODO variable name
    },

    PACKAGE_ENTRY: {
      key: 'PACKAGE_ENTRY',
      message: 'Moet er iemand nu voor naar beneden komen?', // TODO text mag iets duidelijker
      validResponses: {
        positive: ['ja', 'graag'],
        negative: ['nee', 'niet nodig', 'hoeft niet']
      }
    },

    PACKAGE_NOACTION: {
      key: 'PACKAGE_NOACTION',
      message: `Ik breng Innovadis op de hoogte. U mag het achterlaten op de balie.

      Bedankt & tot ziens`
    },

    END: {
      key: 'END',
      message: `Bedankt voor het gebruiken van de Digitale Receptionist.

      Mocht u op- of aanmerkingen hebben hierover, dan worden die erg gewaardeerd. Bedankt!
      `
    }
  }

  export default {
    components: {
      Wave
    },

    data() {
      return {
        speechHistory: [],
        speech: [],
        recognition: null,
        callId: null,
        animateSiri: false,
        currentMessage: null,
        currentState: null,
        lastRecognizedName: null,
        resetTimeout: null
      }
    },

    methods: {
      async log(type, message) {
        if (process.env.NODE_ENV === 'development') {
          console.log('LOG:', message)
          return
        }

        if (type === 'event') {
          await axios.post('http://localhost:3000/api/v1/log/event', {
            message
          })
        } else if (type === 'speech') {
          await axios.post('http://localhost:3000/api/v1/log/speech', {
            speech: message
          })
        } else {
          throw new Error('nyi')
        }
      },

      init() {
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

        this.recognition.onend = () => {
          this.animateSiri = false
        }

        this.recognition.onspeechstart = (event) => {
          this.setState(STATES.AWAIT_INPUT)
        }
      },

      playAudio(path) {
        this.animateSiri = true

        const audio = new Audio(path)

        audio.play()

        audio.onended = () => {
          this.animateSiri = false
        }
      },

      setState(state, replacements) {
        if (!state || !Object.keys(STATES).includes(state.key)) throw new Error('invalid state: ' + state)

        this.currentState = state

        this.log('event', 'state change: ' + state.key)

        let message = state.message

        if (replacements) {
          for (let i = 0; i < replacements.length; i++) {
            if (message.includes('$' + i)) {
              message = message.replace('$' + i, replacements[i])
            }
          }
        }

        this.updateMessage(message)

        if (state.audioPath) {
          this.playAudio(state.audioPath)
        }
      },

      updateMessage(message) {
        if (this.currentMessage !== message) {
          this.currentMessage = null

          setTimeout(() => {
            this.currentMessage = message
          }, 0)
        }
      },

      listen() {
        this.recognition.start()

        this.log('event', 'listen started')
      },

      stop() {
        this.recognition.abort()

        this.log('event', 'listen stopped')
      },

      delayedReset(timeout) {
        timeout = timeout || RESET_TIMEOUT

        this.log('event', 'delayed reset in ' + timeout + 'ms')

        clearTimeout(this.resetTimeout)

        this.resetTimeout = setTimeout(() => {
          window.location.reload()
          // this.speech = []
          // this.speechHistory = []
          // this.lastRecognizedName = null

          // this.setState(STATES.IDLE)

          // this.listen()
        }, timeout)
      },

      processSpeech() {
        // TODO reset after 60 seconds here. Reset timer every time there is input

        switch (this.currentState.key) {
          case STATES.IDLE.key: {
            // responds to any sound from init()

            break
          }

          case STATES.AWAIT_INPUT.key: {
            // check for positive ack
            if (STATES[this.currentState.key].validResponses.positive.some(
              keyword =>
                this.speech.includes(keyword)
            )) {
              this.setState(STATES.AWAIT_REASON)
            }
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

              this.call('reception')

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

              this.call('reception')
            } else if (STATES[this.currentState.key].validResponses.negative.some( // check for negative ack
              keyword =>
                this.speech.includes(keyword)
            )) {
              this.setState(STATES.PACKAGE_NOACTION)

              this.stop()

              // TODO send slack message (or call) that there is a package waiting

              this.delayedReset()
            }

            break
          }

          default:
            throw new Error('unknown state or should not be listening during this state: ' + this.currentState.key)
        }
      },

      async call(target) {
        this.log('event', 'placing call to ' + target)

        if (process.env.NODE_ENV === 'production') {
          await axios.post('http://localhost:3000/api/v1/phone/call', {
            name: this.lastRecognizedName.key
          })
        }

        // TODO await feedback and go to END state if succesful

        // TODO check call progress and retry again or to different number
      }
    },

    mounted() {
      this.setState(STATES.IDLE)

      this.init()

      this.listen()
    }
  }
</script>

<style lang="scss" scoped>
  @import 'src/styles/variables';

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
        content: '.';
        color: $inno-yellow;
      }
    }

    .title {
      color: white;
      font-size: 32px;
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
      content: '';
      height: 200px;
      width: 100%;
      background: linear-gradient(to bottom, $inno-blue-dark 30%, transparent 50%);
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
        &:nth-last-child(n+#{$i}) {
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
