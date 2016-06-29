TalkingStick.Partner = function(participant, options) {
  this.gatheringCandidates = false;
  this.name          = participant.name;
  this.guid          = participant.guid;
  this.joinedAt      = new Date(participant.joined_at);
  this.localICECandidates = [];
  this._options      = {
    videoElement: undefined, // Set this to the DOM element where video should be rendered
  };
  $.extend(this._options, options);
  this.signalingEngine = this._options.signalingEngine;
  this.videoElement    = $(this._options.videoElement);
  this.videoStream     = undefined;
  this.connected       = false;
  this.trigger('created');
}

TalkingStick.Partner.prototype.log = function() {
  var level = arguments[0];
  var args = Array.prototype.slice.call(arguments, 1);
  args.unshift('[Partner ' + this.guid + ']');
  args.unshift(level);
  TalkingStick.log.apply(this, args);
}

TalkingStick.Partner.prototype.trigger = function(name) {
  name = 'talking_stick.partner.' + name;
  args = Array.prototype.slice.call(arguments, 1);
  // Syntactic sugar: make it easy to pass a list of args as the only argument
  // This is the "right way" per
  // http://stackoverflow.com/questions/4775722/check-if-object-is-array
  if (args.length == 1 && Object.prototype.toString.call(args[0]) === '[object Array]') {
    args = args[0];
  }
  args.unshift(this);
  this.videoElement.trigger(name, args);
};

TalkingStick.Partner.prototype.errorCallback = function() {
  // Convert arguments to a real array
  var args = Array.prototype.slice.call(arguments);
  this.trigger('error', args);
  args.unshift('error');
  this.log(args);
}

TalkingStick.Partner.prototype.connect = function(stream) {
  var configuration = {
    iceServers: this._options.iceServers,
  };
  this.log('trace', 'Creating new peer connection with configuration', configuration);
  this.peerConnection = new RTCPeerConnection(configuration);

  var self = this;
  this.peerConnection.oniceconnectionstatechange = function(ev) {
    self.trigger('ice_connection_state_change', ev);
  };

  this.peerConnection.onicecandidate = function() {
    self.handleLocalICECandidate.apply(self, arguments);
  }

  this.peerConnection.addStream(stream);
};

TalkingStick.Partner.prototype.sendOffer = function(options) {
  // Fix scope for "this" inside createOffer()
  var self = this;
  this.peerConnection.createOffer(function(offer) {
    self.log('trace', 'Created PeerConnection Offer; ICE candidate collection starting', offer);
    self.gatheringCandidates = true;
    self.peerConnection.setLocalDescription(offer);
    self.signalingEngine.sendOffer(self.guid, offer);
    setTimeout(self._checkForConnection, self._options.connectionTimeout);
  }, function() { self.errorCallback.apply(self, arguments) } );
};

TalkingStick.Partner.prototype.handleOffer = function(offer) {
  var offer = new RTCSessionDescription(offer);
  this.log('debug', 'Processing Offer received from', this.guid, offer);
  var self = this;

  this.peerConnection.onaddstream = function(event) {
    self._attachMediaStream(event.stream);
    self.connected = true;
  };

  this.peerConnection.setRemoteDescription(offer);

  this.peerConnection.createAnswer(function(answer) {
    self.peerConnection.setLocalDescription(new RTCSessionDescription(answer));
    self.log('debug', 'Sending Answer to', self.guid);
    self.signalingEngine.sendAnswer(self.guid, answer);
  }, function() { self.errorCallback.apply(self, arguments) } );
};

TalkingStick.Partner.prototype.handleAnswer = function(answer) {
  this.log('debug', 'Processing Answer received from', this.guid);
  var self = this;
  this.peerConnection.onaddstream = function(event) {
    self._attachMediaStream(event.stream);
    self.connected = true;
  };
  this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
};

TalkingStick.Partner.prototype.handleRemoteICECandidate = function(candidate) {
  candidate = new RTCIceCandidate(candidate);
  this.log('trace', 'Adding remote ICE candidate', candidate);
  this.peerConnection.addIceCandidate(candidate);
};

TalkingStick.Partner.prototype.handleLocalICECandidate = function(event) {
  var candidate = event.candidate;
  if (candidate) {
    this.log('trace', 'Discovered local ICE candidate', candidate);
    // Store and transmit new ICE candidate
    this.localICECandidates.push(event.candidate);
    this.signalingEngine.sendICECandidate(this.guid, event.candidate);

  } else {
    this.gatheringCandidates = false;
    this.log('debug', 'ICE candidate collection complete');
    this.signalingEngine.iceCandidateGatheringComplete(this.guid, this.localICECandidates);
  }
};

TalkingStick.Partner.prototype.cleanup = function() {
  this.log('debug', 'Cleanup requested, shutting down.');
  this.disconnect();
  this.trigger('cleanup');
}

TalkingStick.Partner.prototype.disconnect = function() {
  try {
    this.peerConnection.close();
  } catch(ex) {
    // Ignore errors here in case the connection is already closed
  }
};

TalkingStick.Partner.prototype._attachMediaStream = function(stream) {
  this.log('trace', 'Attaching media stream');
  var el = this.videoElement[0];
  el.srcObject = stream;
  if (el) {
    // Compatibility with Temasys plugin
    // See https://temasys.atlassian.net/wiki/display/TWPP/How+to+integrate+the+Temasys+WebRTC+Plugin+into+your+website - "Attach streams"
    this.videoElement = $(el);
  }
  partner.videoStream = stream;
  this.trigger('media');
};

TalkingStick.Partner._checkForConnection = function() {
  this.log('trace', 'Checking for connection');
  if (!this.connected) {
    this.log('notice', 'Connection to partner timed out.');
    this.trigger('connection_timeout');
  }
};
