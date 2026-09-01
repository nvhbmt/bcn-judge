// Ca số 0 cho node20.
const data = require('node:fs').readFileSync(0, 'utf8').trim()
if (data) {
  const [a, b] = data.split(/\s+/).map(Number)
  console.log(a + b)
} else {
  console.log('hello')
}
