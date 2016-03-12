(function(){

  console.log('Loaded !')
  
  /* -- init audio stuff -- */
  // Audio Context & Nodes
  var audioCtx = new AudioContext() // create audio context
  var analyser = audioCtx.createAnalyser(); // create audio  analyser
  var oscillator = audioCtx.createOscillator() // create audio source ( here, oscillator )
  var gainNode = audioCtx.createGain() // create audio node ( here, gain )
  // mainly for the audio coming from te microphone ( really needed when it's voice )
  var filter = audioCtx.createBiquadFilter(); // create audio filter
  var microphone = null; // 
  
  // Linking sources & destinations
  oscillator.connect( gainNode ) // connect the oscillator's output to the gain node
  //gainNode.connect( audioCtx.destination ) // connect the gain's output to the default audio output ( speakers )
  gainNode.connect( analyser ); // connect the gain's output to the analyser ( to display them before outputting to spk )
  analyser.connect( audioCtx.destination ) // connect the gain's output to the default audio output ( speakers )
  
  // Additional parameters
  oscillator.type = 'square' // def: sine ( exist: sine, square, swatooth, triangle, custom )
  oscillator.frequency.value = 2500; // def 440
  gainNode.gain.value = 0.5
  //oscillator.detune.value = 150; // not sure of what this does 
  
  
  
  /* -- from serial send - Espruino - © Gordon Williams ;p -- */
  
  // some devices output an inverted waveform, some don't
  var audio_serial_invert = false;

  /** Send the given string of data out over audio. 
      This adds a 1 second preamble/postable to give the 
      capacitor time to charge (so we get a full 2V swing 
      on the output.
 
     If you send characters outside the range 0-255,
     they will be interpreted as a break (so not transmitted).
  */
  function audio_serial_write(data, callback) {
    var sampleRate = 44100;
    var header = sampleRate; // 1 sec to charge/discharge the cap
    var baud = 9600;
    var samplesPerByte = parseInt(sampleRate*11/baud);
    var bufferSize = samplesPerByte*data.length/*samples*/ + header*2;
    //var buffer = context.createBuffer(1, bufferSize, sampleRate);
    var buffer = audioCtx.createBuffer(1, bufferSize, sampleRate);
    var b = buffer.getChannelData(0);

    for (var i=0;i<header;i++) b[i]=i / header;

    var offset = header;

    data.split("").forEach(function(c) {
      var byte = c.charCodeAt(0);
      if (byte>=0 && byte<=255) {    
        for (var i=0;i<samplesPerByte;i++) {
          var bit = Math.round(i*baud/sampleRate);
          var value = 1;
          if (bit==0) value=0; // start bit
          else if (bit==9 || bit==10) value=1; // stop bits
          else value = (byte&(1<<(bit-1))) ? 1 : 0; // data
          b[offset++] = value*2-1; 
        }
      } else {
        // just insert a pause
        for (var i=0;i<samplesPerByte;i++) 
          b[offset++] = 1; 
      }
    });

    for (var i=0;i<header;i++) b[offset+i]=1-(i / header);

    if (audio_serial_invert)
      for (var i=0;i<bufferSize;i++) b[i] = 1-b[i];

    var source = audioCtx.createBufferSource();
    //var source = context.createBufferSource();
    source.connect(analyser);
    source.buffer = buffer;
  
    source.start();

    if (callback)
      window.setTimeout(callback, 1000*bufferSize/sampleRate);
  }
  /* -------------------------------------------------------- */
  
  
  
  // Init Audio
  oscillator.start() // to start the oscillator ( actually playing sound )
  // to init the mike so as to later be able to get input from it --> seems not to work in Chrome on 10.6.8
  
  var initMikeIn = function(){
    navigator.webkitGetUserMedia({audio: true}, function(stream){
      microphone = audioCtx.createMediaStreamSource( stream );
    }, function(err){
      console.log(err)
    });
  };
  
  
  
  
  
  /* -- init controls stuff -- */
  var curOutput; // to be disconnected /reconnected to mute the output to speakers - although the last node before the spk 'll always be the same in our setup: the analyser
  //gainNode.disconnect( audioCtx.destination ) // or to use def: gainNode.disconnect()
  //gainNode.connect( audioCtx.destination )
  
  // clicked oscillo ? disconnect anything from spk & connect oscillo [ & show params on the right for changing some of the oscillator's stuff ? ( type, .. ) ]
  // clicked mike ? disconnect anything from spk & connect mike
  // clicked Audio serial ? disconnect anything from spk & connect stuff to be able to use audio serial
  
  // range sliders & inputs tying / fcnality
  // gain ctrl
  var gainCtrl_rng = document.querySelector('#gainCtrl_rng');
  var gainCtrl_inp = document.querySelector('#gainCtrl_inp');
  // gain ctrl: range slider
  gainCtrl_rng.value = gainNode.gain.value * 100; // init
  gainCtrl_rng.disabled = false; // is disabled by default for debug test(s)
  // to react when using keyboard keys to move the slider's thumb
  gainCtrl_rng.addEventListener('change', function(e){
    console.log('gain ctrl: gain changed -> ' + this.value)
    gainCtrl_inp.value = this.value;
    gainNode.gain.value = this.value / 100; // tie to our audio gain node
  });
  // to react when using mouse to move the slider's thumb ( allows to update even when the click hasn't been release yet )
  gainCtrl_rng.addEventListener('mousemove', function(e){
    console.log('gain ctrl: gain changed -> ' + this.value)
    gainCtrl_inp.value = this.value;
    gainNode.gain.value = this.value / 100; // tie to our audio gain node
  });
  // gain ctrl: input
  gainCtrl_inp.value = gainNode.gain.value * 100; // init
  gainCtrl_inp.disabled = false; // is disabled by default for debug test(s)
  gainCtrl_inp.addEventListener('change', function(e){
    var number = Math.min(Math.max(parseInt(this.value), gainCtrl_rng.min), gainCtrl_rng.max);
    console.log('gain ctrl: gain changed -> min:' + gainCtrl_rng.min + ' max: ' + gainCtrl_rng.max + ' unmapped:' + this.value + ' mapped:' + number);
    this.value = number; // update with correctly mapped number
    gainCtrl_rng.value = number; // update the corresponding range slider as well
    gainNode.gain.value = this.value / 100; // tie to our audio gain node
  });
  
  // freq ctrl
  var freqCtrl_rng = document.querySelector('#oscillatorFreqCtrl_rng');
  var freqCtrl_inp = document.querySelector('#oscillatorFreqCtrl_inp');
  // freq ctrl: range slider
  freqCtrl_rng.value = oscillator.frequency.value; // init
  // to react when using keyboard keys to move the slider's thumb
  freqCtrl_rng.addEventListener('change', function(e){
    console.log('freq ctrl: freq changed -> ' + this.value)
    freqCtrl_inp.value = this.value;
    oscillator.frequency.value = this.value; // tie to our audio oscillator node
  });
  // to react when using mouse to move the slider's thumb ( allows to update even when the click hasn't been release yet )
  freqCtrl_rng.addEventListener('mousemove', function(e){
    console.log('freq ctrl: freq changed -> ' + this.value)
    freqCtrl_inp.value = this.value;
    oscillator.frequency.value = this.value; // tie to our audio oscillator node
  });
  // freq ctrl: input
  freqCtrl_inp.value = oscillator.frequency.value; // init
  freqCtrl_inp.addEventListener('change', function(e){
    var number = Math.min(Math.max(parseInt(this.value), freqCtrl_rng.min), freqCtrl_rng.max);
    console.log('freq ctrl: freq changed -> min:' + freqCtrl_rng.min + ' max: ' + freqCtrl_rng.max + ' unmapped:' + this.value + ' mapped:' + number);
    this.value = number; // update with correctly mapped number
    freqCtrl_rng.value = number; // update the corresponding range slider as well
    oscillator.frequency.value = this.value; // tie to our audio gain node
  });
  
  // fft ctrl
  // helper to get a pow of 2
  function nearestPow2( aSize ){
    return Math.pow( 2, Math.round( Math.log( aSize ) / Math.log( 2 ) ) ); 
  }
  var fftSizeCtrl_rng = document.querySelector('#fftSizeCtrl_rng');
  var fftSizeCtrl_inp = document.querySelector('#fftSizeCtrl_inp');
  // fft ctrl: range slider
  fftSizeCtrl_rng.value = analyser.fftSize; // init
  // to react when using keyboard keys to move the slider's thumb
  fftSizeCtrl_rng.addEventListener('change', function(e){
    console.log('fft ctrl: fft changed -> ' + this.value)
    fftSizeCtrl_inp.value = this.value;
    //analyser.fftSize = this.value; // tie to our audio analyser fft
    analyser.fftSize = nearestPow2(this.value); // same as above but constraining to a pow of 2
  });
  // to react when using mouse to move the slider's thumb ( allows to update even when the click hasn't been release yet )
  fftSizeCtrl_rng.addEventListener('mousemove', function(e){
    console.log('fft ctrl: fft changed -> ' + this.value)
    fftSizeCtrl_inp.value = this.value;
    //analyser.fftSize = this.value; // tie to our audio analyser fft
    analyser.fftSize = nearestPow2(this.value); // same as above but constraining to a pow of 2
  });
  // fft ctrl: input
  fftSizeCtrl_inp.value = analyser.fftSize; // init
  fftSizeCtrl_inp.addEventListener('change', function(e){
    var number = Math.min(Math.max(parseInt(this.value), fftSizeCtrl_rng.min), fftSizeCtrl_rng.max);
    console.log('fft ctrl: fft changed -> min:' + fftSizeCtrl_rng.min + ' max: ' + fftSizeCtrl_rng.max + ' unmapped:' + this.value + ' mapped:' + number);
    this.value = number; // update with correctly mapped number
    fftSizeCtrl_rng.value = number; // update the corresponding range slider as well
    //analyser.fftSize = this.value; // tie to our audio analyser fft
    analyser.fftSize = nearestPow2(this.value); // same as above but constraining to a pow of 2
  });
  
  // spk ctrl
  var spkCtrls = document.querySelectorAll('input[name="audioOutput"]');
  [].forEach.call(spkCtrls, function(spkCtrl){
    spkCtrl.addEventListener('change', function(e){
      console.log('spk ctrl: selection changed -> ' + this.name + ' : ' + this.id + ' is checked: ' + this.checked);
      if( this.id === 'audioOn' ) analyser.connect( audioCtx.destination );
      else analyser.disconnect( audioCtx.destination );
    });
  });
  
  // src ctrl
  var srcCtrls = document.querySelectorAll('input[name="audioSource"]'); // r: we could also use input[name="text"][name="audioSource"] ;D
  [].forEach.call(srcCtrls, function(srcCtrl){
    srcCtrl.addEventListener('change', function(e){
      console.log('srcCtrl ctrl: selection changed -> ' + this.name + ' : ' + this.id + ' is checked: ' + this.checked);
      if( this.id === 'oscillatorSrc' ) { /* show params for oscillator / disable others or transition-hide them    - params: detune / type[sine|suqare|triangle|swatooth|custom] / fcn ? */ }
      else if ( this.id === 'mikeSrc' ) { /* show params for mike / disable others or transition-hide them    - params: filter toggle / filter type [..] & stuff ? / (..) ? */ }
      else if ( this.id === 'serialSrc' ) { /* show params for audio serial / disable others or transition-hide them    - params: baud / invert / sample rate / fcn[Espruino|FSK|..] / fcn ? */ }
      else { /* file input later anyone ? */ }
    });
  });
  
  /* -- init waveform stuff -- */
  // std pattern to setup a buffer
  analyser.fftSize = 2048; // the suggested default in the tut
  //analyser.fftSize = 4096; // more stuff ;p
  //analyser.fftSize = 1024;
  //analyser.fftSize = 512;
  //analyser.fftSize = 256;
  var bufferLength = analyser.frequencyBinCount;
  var dataArray = new Uint8Array(bufferLength);
  // get ref to canvas
  var canvas = document.querySelector('canvas');
  var canvasCtx = canvas.getContext('2d');
  var WIDTH = canvas.getClientRects()[0].width; // window.innerWidth;
  var HEIGHT = canvas.getClientRects()[0].height;
  // clear any previous stuff drawn
  canvasCtx.clearRect(0, 0, WIDTH, HEIGHT)
  
  // define drawing fcn for the visualyser ( which draws stuff from the audio analyser )
  var visualAnimframe;
  var visualyserDraw = function(){
  	// use request anim frame to keep looping the drawing fcn once started
    visualAnimframe = requestAnimationFrame( visualyserDraw );
    // then, we grab the time domain & copy it into our array
    analyser.getByteTimeDomainData( dataArray );
    // next, we fill the canvas witha solid color to start ----> R: we may NOT want that if we display our grid BELOW the canvas
    //canvasCtx.globalAlpha = 0; // hack to clear while maintaining a transparent background ?
    //canvasCtx.fillStyle = 'rgb(200, 200, 200)';
    //canvasCtx.fillStyle = 'white'; // r: nice looking
    canvasCtx.fillStyle = 'black';
    //canvasCtx.globalCompositeOperation = 'overlay';
    //canvasCtx.globalAlpha = 1;
    //canvasCtx.globalAlpha = 0.1;
    //canvasCtx.fillStyle = 'transparent'; // R: allows to see the grid through, but not quite useful since we still get a trail ..
    //canvasCtx.fillStyle = 'rgba(200, 200, 200, 0.1)'; // R: leaves a nice trail effect if not set ;p
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
    // we then set a line width & stroke color for the wave we'll draw, & beging drawing a path
    //canvasCtx.lineWidth = 2;
    //canvasCtx.lineWidth = 1; // nice
    canvasCtx.lineWidth = 0.8;
    //canvasCtx.webkitImageSmoothingEnabled = true;
    //CanvasRenderingContext2D.imageSmoothingEnabled
    canvasCtx.imageSmoothingEnabled = true;
    canvasCtx.strokeStyle = "#69b6d5";
    //canvasCtx.strokeRect(10, 10, 100, 100);
    //canvasCtx.stokeStyle = 'rgb(200, 200, 10)';
    //canvasCtx.stokeStyle = 'rgb(0, 0, 0)'; // -------> R: change the color to our nice blue ;)
    //canvasCtx.stokeStyle = 'rgb(105, 182, 213)'; // #69b6d5
    canvasCtx.beginPath();
    // we determine the width of each segment of the line to be drawn by dividing the canvas width by th earray length ( equal to the FrequencyBinCount, as defined earlier on ),
    // then define an x variable to define the position to move to for drawing each segment of the line
    var sliceWidth = WIDTH * 1.0 / bufferLength; //buffer.length;
    var x = 0;
    // then, we run through a loop, defining the position of a small segment of the wave for each point in the buffer at a certain height based on the data point value from the array,
    // the nmoving the line across to the place where the next wave segment should be drawn
    //for (var i = 0; i < buffer.length; i++){
    for (var i = 0; i < bufferLength; i++){
      var v = dataArray[i] / 128.0;
      var y = v * HEIGHT/2;
      if ( i=== 0 ) canvasCtx.moveTo(x, y)
      else canvasCtx.lineTo(x, y)
      x+= sliceWidth;
    }
    // finally, we finish the line in the middle of the right hand side of the canvas, then draw the stroke we've defined
    canvasCtx.lineTo(canvas.width, canvas.height/2);
    canvasCtx.stroke();
  }
  // at the end of this section of code, we invoke the 'draw()' fcn to start off the whole process
  visualyserDraw();
  
  /* -- namespace & stuff accessible from outside -- */
  var AST = {};//var AST = window.AST || {};
  AST.audioCtx = audioCtx;
  AST.analyser = analyser;
  AST.oscillator = oscillator;
  AST.gainNode = gainNode;
  
  AST.filter = filter;
  AST.microphone = microphone;
  AST.initMike = initMikeIn;
  
  AST.audio_serial_invert = audio_serial_invert;
  AST.audio_serial_write = audio_serial_write;
  
  window.AST = AST;
  
  

})();