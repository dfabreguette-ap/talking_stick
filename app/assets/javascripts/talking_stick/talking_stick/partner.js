TalkingStick.Partner = function(participant, options) {
  this.gatheringCandidates = false;
  this.guid          = participant.guid;
  this.registerTime  = new Date(participant.created_at);
  this.iceCandidates = [];
  this._options      = {
    videoElement: undefined, // Set this to the DOM element where video should be rendered
  };
  $.extend(this._options, options);
  this.signalingEngine = this._options.signalingEngine;
}

TalkingStick.Partner.prototype.log = function() {
  var level = arguments[0];
  var args = Array.prototype.slice.call(arguments, 1);
  args.unshift('[Partner ' + this.guid + ']');
  args.unshift(level);
  TalkingStick.log.apply(this, args);
}

TalkingStick.Partner.prototype.errorCallback = function() {
  // Convert arguments to a real array
  var args = Array.prototype.slice.call(arguments);
  args.unshift('error');
  this.log(args);
}

TalkingStick.Partner.prototype.setDescription = function(answer) {
  this.log('trace', 'Setting remote description to', answer);
  this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
};

TalkingStick.Partner.prototype.connect = function(stream) {
  this.log('trace', 'Creating new peer connection');
  this.gatheringCandidates = true;
  this.peerConnection = new RTCPeerConnection();
  this.peerConnection.onicecandidate = this.handleICECandidate;

  this.peerConnection.addStream(stream);
  // TODO: Finish this!
};

TalkingStick.Partner.prototype.handleICECandidate = function(event) {
  var candidate = event.candidate;
  if (candidate) {
    this.log('trace', 'Received ICE candidate', candidate);
    this.peerConnection.addIceCandidate(new RTCIceCandidate({candidate: candidate}));
    // Store and transmit new ICE candidate
    this.iceCandidates.push(event.candidate);

  } else {
    this.gatheringCandidates = false;
    this.log('trace', 'ICE candidate collection complete');
  }
};

