

let host = location.hostname; //ホスト名取得
hostname = "https://" + host + ":3000";
let socket = io(hostname);　//ソケットを運用しているサーバーをセット　　この場合はポート番号3000
$(document).ready(function () {
    
    let query = decodeURIComponent(location.search);//ポート番号から後ろのURLを取得
    let value = query.split('=');//=で区切られた文字列を配列に収納
    let user = value[1];//ユーザ名
    let room = value[3];//参加している部屋名
    

 
    let userNodeSpaceInfo = { //一番上の層の高さと幅
        w: 0,
        h: 0,
    };
    userNodeSpaceInfo.h = document.getElementById('userNodeSpace').clientHeight;
    userNodeSpaceInfo.w = document.getElementById('userNodeSpace').clientWidth;
   
    //実験に必要な変数
    let videoLabel;
    let videoId;
    let videoFlg = false;
    let audioLabel;
    let audioId;
    let audioFlg = false;
    let connectUsers = [];
    let connectionChangeFlg = false;

    let experimental = false;//実験用のフラグ   
    if (room == "実験用") { 
        experimental = true;
        videoLabel = value[5];
        //console.log(videoLabel);
        audioLabel = value[7];
    }
   //

    let nodeInfo = {//自分自身のオブジェクトの情報
        x: 0,//x座標
        y: 0,//y座標
        w: 0,//高さ
        h: 0,//幅
        range: 90,//オーラの半径
    };
    let otherUser = [];//他のユーザの配列
    let mute = true;//自分自身のミュートフラグ
    let muteUser = {};//他のユーザのミュート情報（連想配列）
    let spee = 5;//移動スピード　5pxずつ
    let localVideo = document.getElementById('myVideo');//自分自身の映像を貼り付けるエリアの取得
    
    //p2p通信に必要な変数
    let localStream = null;
    let peerConnections = [];
    let userId = [];
    let remoteVideos = [];
    const MAX_CONNECTION_COUNT = 100;
    let otherVideoSpace = document.getElementById('otherVideoSpace');
    _assert('otherVideoSpace', otherVideoSpace);
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia || navigator.msGetUserMedia;
    RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
    RTCSessionDescription = window.RTCSessionDescription || window.webkitRTCSessionDescription || window.mozRTCSessionDescription;
    //

    //カメラ・オーディオ機器の切り替えに必要な変数
    let firstStream = true;
    let audioSelect = $('#audioSource');
    let videoSelect = $('#videoSource');
    let memberNum = 0;
    let videoDevice = false;
    let device = false;//デバイス検出　フラグ
    //

    




    if (experimental == true) {
        const exit = $('<div id="exit"> 出口</div>');
        $('#userNodeSpace').append(exit);
    }
    else {
        $('#roomID').text(room);
    }

    writeMyNode(user);//自分のオブジェクトを描画
    
    socket.emit('login', user, room);//自分の情報をサーバーに送信

    getDevice();//使えるカメラ・オーディオ機器を検知

    function getDevice() {
        navigator.mediaDevices.enumerateDevices()
            .then(function (deviceInfos) {
                for (let i = 0; i !== deviceInfos.length; ++i) {
                    let deviceInfo = deviceInfos[i];
                    let option = $('<option>');
                    option.val(deviceInfo.deviceId);
                    if (deviceInfo.label != "") {
                        device = true;//デバイスが検出されなかったら最後までfalse
                    }
                    if (deviceInfo.kind == 'audioinput') {//オ―ディオデバイスなら
                        option.text(deviceInfo.label);
                        audioSelect.append(option);

                        //実験システム用
                        if (deviceInfo.label == audioLabel) {
                            audioFlg = true;
                            audioId = deviceInfo.deviceId;
                        }
                        //
                    } else if (deviceInfo.kind == 'videoinput') {//ビデオデバイスなら
                        option.text(deviceInfo.label);
                        videoSelect.append(option);
                        //実験システム用
                        if (deviceInfo.label == videoLabel) {
                            videoFlg = true;
                            videoId = deviceInfo.deviceId;
                        }
                        //

                        if (deviceInfo.label != "") {//ビデオデバイスが一つでもPCに繋がれているなら
                            videoDevice = true;
                        }
                    }
                }
                videoSelect.on('change', startVideo);//ビデオデバイスが変更されたら
                audioSelect.on('change', startVideo);//オーディオバイスが変更されたら
                startVideo();//自分の映像を取得する
            }).catch(function (error) {
                console.error('mediaDevices.enumerateDevices() error', error);
                return;
            });
    }

    //ログインした部屋の先に入っている他の人のデータを取得
    socket.on('memberData', function (userName, x, y, muteInfo, num) {
        writeOtherNode(userName, x, y);//他ユーザのオブジェクトを描画
        otherUser.unshift(userName);
        muteUser[userName] = muteInfo;
        memberNum = num;
    });

    //誰かが入ってきたら送られてくる情報
    socket.on('loginInfo', function (userName, id, num) {
        socket.emit('submitData', id, user, nodeInfo.x, nodeInfo.y, num);
        writeOtherNode(userName, 0, 0);
        otherUser.unshift(userName);
        muteUser[userName] = true;
    });

    //誰かのnodeの位置が更新された時
    socket.on('updateOtherNode', function (userName, x, y) {
        updateNode(userName, x, y);
    });

    //誰かがミュート切り替えをしたとき
    socket.on('userMuteSwitching', function (userName, muteInfo) {
        muteUser[userName] = muteInfo;
        rangeJudgment(userName);
        connectionChangeFlg = false;
    });

    //誰かがデバイスを切り替えた時
    socket.on('userChangeDevice', function (userName, id) {
        let peer = getConnection(id);
        peer.close();
        deleteConnection(id);
        delete remoteVideos[id];
        socket.emit('restartConnect', id);
    });

    //通信を繋ぎなおす
    socket.on('restart', function (id) {
        connect();
    });

    //誰かが通信を切断した時
    socket.on('disconnectUser', function (userName) {
        removeNode(userName);
        delete muteUser[userName];
    });

    //自分のnodeの描画
    function writeMyNode(userName) {
        const node = $('<div id="myNode">' + userName + '</div>');
        $('#userNodeSpace').append(node);
        let NODE = document.getElementById('myNode');
        nodeInfo.x = 0;
        nodeInfo.y = 0;
        nodeInfo.w = NODE.clientWidth;//cssのmynodeから高さを取得
        nodeInfo.h = NODE.clientHeight;//cssのmynodeから幅を取得
        NODE.style.left = nodeInfo.x + 'px';//cssのx座標を書き換える　pxもセット
        NODE.style.top = nodeInfo.y + 'px';//cssのy座標を書き換える　pxもセット
        writeRangeNode("me", nodeInfo.x, nodeInfo.y)
    }

    //オーラの描画
    function writeRangeNode(userName, x, y) {
        const node = $('<div id="' + userName + '" class = "rangeNode">');
        $('#userNodeSpace').append(node);
        let NODE = document.getElementById(userName);
        x = x + nodeInfo.w / 2 - nodeInfo.range;//オブジェクトの座標から中心を計算し，オーラの半径からオーラを描画するx軸を計算
        y = y + nodeInfo.h / 2 - nodeInfo.range;//オブジェクトの座標から中心を計算し，オーラの半径からオーラを描画するy軸を計算

        NODE.style.left = x + 'px';
        NODE.style.top = y + 'px';
    }

    //オーラの更新処理
    function updateRangeNode(userName, x, y) {
        let NODE = document.getElementById(userName);
        x = x + nodeInfo.w / 2 - nodeInfo.range;
        y = y + nodeInfo.h / 2 - nodeInfo.range;
        NODE.style.left = x + 'px';
        NODE.style.top = y + 'px';
    }

    //範囲判定
    function rangeJudgment(userName) {
        try {
            let NODE = document.getElementById(userName);
            let video = document.getElementById('video_' + userName);
            let x = parseInt(NODE.style.left, 10) + nodeInfo.w / 2;//userNameのx座標を取得し，中心のx座標を計算
            let y = parseInt(NODE.style.top, 10) + nodeInfo.h / 2;//userNameのy座標を取得し，中心のx座標を計算
            let myX = nodeInfo.x + nodeInfo.w / 2;
            let myY = nodeInfo.y + nodeInfo.h / 2;
            let distance = Math.sqrt(Math.pow(myX - x, 2) + Math.pow(myY - y, 2));//自分のオブジェクトとuseNameオブジェクトとの距離を計算
            if (distance > nodeInfo.range * 2) {
                if (video.style.display == "block") {
                    connectUsers.splice(connectUsers.indexOf(userName), 1);
                    video.style.display = "none";//userNameの映像を消す
                    video.volume = 0;//userNameの音量を消す
                    connectionChangeFlg = true;
                }
            } else {
                if (video.style.display == "none" || video.style.display == "") {
                    video.style.display = "block";
                    connectUsers.unshift(userName);
                    connectionChangeFlg = true;
                }

                if (muteUser[userName] == true) {
                    video.volume = 0;
                }
                else {
                    let v = Math.floor(10 * (1 - distance / (nodeInfo.range * 2 + nodeInfo.w / 2)));//相手との距離によって音量を変更するための計算　　0.0~1.0
                    video.volume = v / 10;
                }
            }
            //console.log(connectUsers);
        }
        catch (e) {
            console.error(e);
        }
    }
    //実験データ取得用
    function sendConnectionUsers(first) {
        if (connectionChangeFlg == true && experimental == true) {
            socket.emit('connectEvent', connectUsers, first);
            connectionChangeFlg = false;
        }
    }

    //他ユーザのオブジェクトを追加
    function writeOtherNode(userName, x, y) {
        const node = $('<div id="' + userName + '" class="otherNode">' + userName + '</div>');
        $('#userNodeSpace').append(node);
        let NODE = document.getElementById(userName);
        NODE.style.left = x + 'px';
        NODE.style.top = y + 'px';
        writeRangeNode(userName + "Range", x, y);
    }

    //他ユーザのオブジェクト更新処理
    function updateNode(userName, x, y) {
        let NODE = document.getElementById(userName);
        NODE.style.left = x + 'px';
        NODE.style.top = y + 'px';
        rangeJudgment(userName);
        connectionChangeFlg = false;
        updateRangeNode(userName + "Range", x, y);

    }

    //切断したユーザのオブジェクトとオーラの消去処理
    function removeNode(userName) {
        $('#' + userName).remove();
        $('#' + userName + "Range").remove();
        otherUser.splice(otherUser.indexOf(userName), 1);
        let i = connectUsers.indexOf(userName);
        if (i != -1) {
            connectUsers.splice(i, 1);
        }
    }


    //自分のオブジェクト操作
    document.addEventListener('keydown', (event) => {
        let keyName = event.key;
        let NODE = document.getElementById('myNode');
        let flg = false;

        if (keyName == 'w' || keyName == 'ArrowUp') {
            if (nodeInfo.y > 0) {
                nodeInfo.y -= spee;
                flg = true;
            }
        }
        if (keyName == 's' || keyName == 'ArrowDown') {
            if (nodeInfo.y + nodeInfo.h < userNodeSpaceInfo.h) {
                nodeInfo.y += spee;
                flg = true;
            }
        }
        if (keyName == 'a' || keyName == 'ArrowLeft') {
            if (nodeInfo.x > 0) {
                nodeInfo.x -= spee;
                flg = true;
            }
        }
        if (keyName == 'd' || keyName == 'ArrowRight') {
            nodeInfo.x += spee;
            flg = true;
        }
        if (keyName == 'r'){
            startVideo();
        }
        NODE.style.left = nodeInfo.x + 'px';
        NODE.style.top = nodeInfo.y + 'px';

        updateRangeNode("me", nodeInfo.x, nodeInfo.y);


        if (experimental == true) {
            if (userNodeSpaceInfo.w - 10 < nodeInfo.x + nodeInfo.w) {
                window.close();
            }
        }
        for (let i = 0; i < otherUser.length; i++) {
            rangeJudgment(otherUser[i]);
        }

        sendConnectionUsers(false);//実験データ取得用

        if (flg == true)
            socket.emit('updateNode', nodeInfo.x, nodeInfo.y);//自分の移動した座標を送る
    });

    //カメラ・オーディオデバイスの変更がされたら
    function changeDevice() {
        for (let id in peerConnections) {
            peerConnections[id].close();
            deleteConnection(id);
            delete remoteVideos[id];
        }
        socket.emit('changeDevice');//切り替えが行われたことを他ユーザに伝える
    }

    //ミュートを切り替えたら
    $('#muteSwitching').click(function () {
        mute = !mute;
        socket.emit('muteSwitching', user, mute);//他ユーザに自分のミュート状態を伝える
        if (mute == false) {
            document.getElementById("muteSwitching").innerHTML = "現在：マイクON";
        }
        else {
            document.getElementById("muteSwitching").innerHTML = "現在：マイクOFF";
        }
    });




    //ここから，p2p通信のためのコード
    //参照用URL　→　https://html5experts.jp/series/webrtc-beginner/

    function _assert(desc, v) {
        if (v) {
            return;
        }
        else {
            let caller = _assert.caller || 'Top level';
            console.error('ASSERT in %s, %s is :', caller, desc, v);
        }
    }

    $('#stopVideo').click(function () {
        stopVideo();
    });
    $('#hangUp').click(function () {
        hangUp();
    });



    socket.on('message', function (message) {
        
        let fromId = message.from;
        let userName = message.userName;
      

        if (message.type === 'offer') {
            
        
            let offer = new RTCSessionDescription(message);
            setOffer(fromId, offer, userName);
        }
        else if (message.type === 'answer') {
            let answer = new RTCSessionDescription(message);
            setAnswer(fromId, answer);
        }
        else if (message.type === 'candidate') {
            let candidate = new RTCIceCandidate(message.ice);
            addIceCandidate(fromId, candidate);
        }
        else if (message.type === 'call me') {
            if (!isReadyToConnect()) {
                return;
            }
            else if (!canConnectMore()) {
                console.warn('TOO MANY connections, so ignore');
            }

            if (isConnectedWith(fromId)) {
            }
            else {
                makeOffer(fromId, userName);
            }
        }
        else if (message.type === 'bye') {
            if (isConnectedWith(fromId)) {
                stopConnection(fromId, userName);
            }
        }
    });
    socket.on('user disconnected', function (evt) {
        let id = evt.id;
        let userName = evt.userName;
        if (isConnectedWith(id)) {
            stopConnection(id, userName);
        }
    });

    function emitRoom(msg) {
        socket.emit('message', msg);
    }

    function emitTo(id, msg) {
        msg.userName = user;
        msg.sendto = id;
        socket.emit('message', msg);
    }


    function isReadyToConnect() {
        if (localStream) {
            return true;
        }
        else {
            return false;
        }
    }

   function getConnectionCount() {
        return peerConnections.length;
    }

    function canConnectMore() {
        return (getConnectionCount() < MAX_CONNECTION_COUNT);
    }

    function isConnectedWith(id) {
        if (peerConnections[id]) {
            return true;
        }
        else {
            return false;
        }
    }

    function addConnection(id, peer) {
        _assert('addConnection() peer', peer);
        _assert('addConnection() peer must NOT EXIST', (!peerConnections[id]));
        peerConnections[id] = peer;
        userId.unshift(id);
    }

    function getConnection(id) {
        let peer = peerConnections[id];
        _assert('getConnection() peer must exist', peer);
        return peer;
    }

    function deleteConnection(id) {
        _assert('deleteConnection() peer must exist', peerConnections[id]);
        delete peerConnections[id];
        userId.splice(userId.indexOf(id), 1);
    }

    function stopConnection(id, userName) {
        detachVideo(id, userName);

        if (isConnectedWith(id)) {
            let peer = getConnection(id);
            peer.close();
            deleteConnection(id);
        }
    }

    function stopAllConnection() {
        for (let id in peerConnections) {
            stopConnection(id, userName);
        }
    }

 
    function attachVideo(id, stream, userName) {
        
        let video = addRemoteVideoElement(id, userName);
        playVideo(video, stream);
        rangeJudgment(userName);

        let num = Object.keys(remoteVideos).length;
        if (num == (memberNum - 1)) {
            sendConnectionUsers(true)
            connectionChangeFlg = false;
        }
        //video.volume = 1.0;
    }

    function detachVideo(id, userName) {
        let video = getRemoteVideoElement(id);
        pauseVideo(video);
        deleteRemoteVideoElement(id, userName);
    }

    function isRemoteVideoAttached(id) {
        if (remoteVideos[id]) {
            return true;
        }
        else {
            return false;
        }
    }

    function addRemoteVideoElement(id, userName) {
        _assert('addRemoteVideoElement() video must NOT EXIST', (!remoteVideos[id]));
        let video;

        video = createVideoElement('video_' + userName);
        remoteVideos[id] = video;
        return video;
    }

    function getRemoteVideoElement(id) {
        let video = remoteVideos[id];
        _assert('getRemoteVideoElement() video must exist', video);
        return video;
    }

    function deleteRemoteVideoElement(id, userName) {
        _assert('deleteRemoteVideoElement() stream must exist', remoteVideos[id]);
        removeVideoElement('video_' + userName);
        delete remoteVideos[id];
    }

    function createVideoElement(elementId) {
        let video;
        if (document.getElementById(elementId) == null) {
            video = document.createElement('video');
            video.id = elementId;
            video.className = 'otherVideos'
            otherVideoSpace.appendChild(video);
        } else {
            video = document.getElementById(elementId);
        }
        /*
        video.width = '240';
        video.height = '180';
        video.style.border = 'solid black 1px';
        video.style.margin = '2px';
        video.style.float = 'left';
        */
        return video;
    }

    function removeVideoElement(elementId) {
        //console.log(elementId);
        let video = document.getElementById(elementId);
        _assert('removeVideoElement() video must exist', video);

        otherVideoSpace.removeChild(video);
        return video;
    }

 
    // start local video
    function startVideo() {
        let audioSource;
        let videoSource;
        if (audioFlg == true) {
            audioSource = audioId;
        } else {
            audioSource = $('#audioSource').val();
        }
        if (videoFlg == true) {
            videoSource = videoId;
        } else {
            videoSource = $('#videoSource').val();
        }

        let constrains = {
            audio: { deviceId: { exact: audioSource } },
            video: { deviceId: { exact: videoSource } }
        };
        if (device == false) {
            constrains = { audio: true, video: true };
        }else if(videoDevice == false){
            constrains = {
                audio: { deviceId: { exact: audioSource } },
                video: false
            }
            console.log("seeeee");
        }
        if (localStream) {
            localStream = null;
        }
        if (room == '設定用') {
            let devices = "マイク:" + $('#audioSource').text() + "  カメラ:" + $('#videoSource').text();
            $('#roomID').text(devices);
        }


        
        getDeviceStream(constrains) //    audio: false <-- ontrack once, audio:true --> ontrack twice!!
            .then(function (stream) { // success
                localStream = stream;
                playVideo(localVideo, stream);
                connect();
                if (firstStream == true) {
                    firstStream = false;
                } else {
                    changeDevice();
                }
            }).catch(function (error) { // error
                console.error('getUserMedia error:', error);
                return;
            });
    }

    // stop local video
    function stopVideo() {
        pauseVideo(localVideo);
        stopLocalStream(localStream);
        localStream = null;
    }

    function stopLocalStream(stream) {
        let tracks = stream.getTracks();
        if (!tracks) {
            console.warn('NO tracks');
            return;
        }

        for (let track of tracks) {
            track.stop();
        }
    }

    function getDeviceStream(option) {
        if ('getUserMedia' in navigator.mediaDevices) {
            //console.log('navigator.mediaDevices.getUserMadia');
            return navigator.mediaDevices.getUserMedia(option);
        }
        else {
            //console.log('wrap navigator.getUserMadia with Promise');
            return new Promise(function (resolve, reject) {
                navigator.getUserMedia(option,
                    resolve,
                    reject
                );
            });
        }
    }

    function playVideo(element, stream) {
        if ('srcObject' in element) {
            element.srcObject = stream;
        }
        else {
            element.src = window.URL.createObjectURL(stream);
        }
        element.play();
        element.volume = 0;
    }

    function pauseVideo(element) {
        element.pause();
        if ('srcObject' in element) {
            element.srcObject = null;
        }
        else {
            if (element.src && (element.src !== '')) {
                window.URL.revokeObjectURL(element.src);
            }
            element.src = '';
        }
    }

    /*--
    // ----- hand signaling ----
    function onSdpText() {
      let text = textToReceiveSdp.value;
      if (peerConnection) {
        //console.log('Received answer text...');
        let answer = new RTCSessionDescription({
          type : 'answer',
          sdp : text,
        });
        setAnswer(answer);
      }
      else {
        //console.log('Received offer text...');
        let offer = new RTCSessionDescription({
          type : 'offer',
          sdp : text,
        });
        setOffer(offer);
      }
      textToReceiveSdp.value ='';
    }
    --*/

    function sendSdp(id, sessionDescription) {
        //console.log('---sending sdp ---');

        /*---
        textForSendSdp.value = sessionDescription.sdp;
        textForSendSdp.focus();
        textForSendSdp.select();
        ----*/

        let message = { type: sessionDescription.type, sdp: sessionDescription.sdp };
        //console.log('sending SDP=' + message);
        //ws.send(message);
        emitTo(id, message);
    }

    function sendIceCandidate(id, candidate) {
        //console.log('---sending ICE candidate ---');
        let obj = { type: 'candidate', ice: candidate };
        //let message = JSON.stringify(obj);
        ////console.log('sending candidate=' + message);
        //ws.send(message);

        if (isConnectedWith(id)) {
            emitTo(id, obj);
        }
        else {
            console.warn('connection NOT EXIST or ALREADY CLOSED. so skip candidate')
        }
    }


    function prepareNewConnection(id, userName) {
       
            let pc_config = {
                "iceServers": [
                    { "urls": "stun:stun2.l.google.com:19302" },
                    { "urls": "turn:tk2-236-27619.vs.sakura.ne.jp:3478?transport=udp", "username": "jaist", "credential": "knlab-jaist" },
                    { "urls": "turn:tk2-236-27619.vs.sakura.ne.jp:3478?transport=tcp", "username": "jaist", "credential": "knlab-jaist" }
                ]
            };
        
        let peer = new RTCPeerConnection(pc_config);

        // --- on get remote stream ---
        if ('ontrack' in peer) {
            peer.ontrack = function (event) {
                let stream = event.streams[0];
                //console.log('-- peer.ontrack() stream.id=' + stream.id);
                if (isRemoteVideoAttached(id)) {
                    //console.log('stream already attached, so ignore');
                }
                else {
                    //playVideo(remoteVideo, stream);
                    attachVideo(id, stream, userName);
                }
            };
        }
        else {
            peer.onaddstream = function (event) {
                let stream = event.stream;
                //console.log('-- peer.onaddstream() stream.id=' + stream.id);
                //playVideo(remoteVideo, stream);
                attachVideo(id, stream, userName);
            };
        }

  
        peer.onicecandidate = function (evt) {
            if (evt.candidate) {
                //console.log(evt.candidate);

                // Trickle ICE の場合は、ICE candidateを相手に送る
                sendIceCandidate(id, evt.candidate);
                // Vanilla ICE の場合には、何もしない
            } else {
                //console.log('empty ice event');

                // Trickle ICE の場合は、何もしない
                // Vanilla ICE の場合には、ICE candidateを含んだSDPを相手に送る
                //sendSdp(id, peer.localDescription);
            }
        };

   
        peer.onnegotiationneeded = function (evt) {
            //console.log('-- onnegotiationneeded() ---');
        };

      
        peer.onicecandidateerror = function (evt) {
            //console.error('ICE candidate ERROR:', evt);
        };

        peer.onsignalingstatechange = function () {
            //console.log('== signaling status=' + peer.signalingState);
        };

        peer.oniceconnectionstatechange = function () {
            //console.log('== ice connection status=' + peer.iceConnectionState);
            if (peer.iceConnectionState === 'disconnected') {
                //console.log('-- disconnected --');
                //hangUp();
                //stopConnection(id, userName);

            }
        };

        peer.onicegatheringstatechange = function () {
            //console.log('==***== ice gathering state=' + peer.iceGatheringState);
        };

        peer.onconnectionstatechange = function () {
            //console.log('==***== connection state=' + peer.connectionState);
        };

        peer.onremovestream = function (event) {
   
            deleteRemoteStream(id);
            detachVideo(id, userName);
        };


        if (localStream) {
        
            peer.addStream(localStream);
        }
        else {
            console.warn('no local stream, but continue.');
        }

        return peer;
    }

    function makeOffer(id, userName) {
        _assert('makeOffer must not connected yet', (!isConnectedWith(id)));
        peerConnection = prepareNewConnection(id, userName);
        addConnection(id, peerConnection);

        peerConnection.createOffer()
            .then(function (sessionDescription) {
                //console.log('createOffer() succsess in promise');
                return peerConnection.setLocalDescription(sessionDescription);
            }).then(function () {
                //console.log('setLocalDescription() succsess in promise');

                // -- Trickle ICE の場合は、初期SDPを相手に送る -- 
                sendSdp(id, peerConnection.localDescription);

                // -- Vanilla ICE の場合には、まだSDPは送らない --
            }).catch(function (err) {
                console.error(err);
            });
    }

    function setOffer(id, sessionDescription, userName) {
        /*
        if (peerConnection) {
          console.error('peerConnection alreay exist!');
        }
        */
        _assert('setOffer must not connected yet', (!isConnectedWith(id)));
        let peerConnection = prepareNewConnection(id, userName);
        addConnection(id, peerConnection);

        peerConnection.setRemoteDescription(sessionDescription)
            .then(function () {
            
                makeAnswer(id);
            }).catch(function (err) {
                console.error('setRemoteDescription(offer) ERROR: ', err);
            });
    }

    function makeAnswer(id) {

        let peerConnection = getConnection(id);
        if (!peerConnection) {
            console.error('peerConnection NOT exist!');
            return;
        }

        peerConnection.createAnswer()
            .then(function (sessionDescription) {
             
                return peerConnection.setLocalDescription(sessionDescription);
            }).then(function () {
                

                // -- Trickle ICE の場合は、初期SDPを相手に送る -- 
                sendSdp(id, peerConnection.localDescription);

                // -- Vanilla ICE の場合には、まだSDPは送らない --
            }).catch(function (err) {
                console.error(err);
            });
    }

    function setAnswer(id, sessionDescription) {
        let peerConnection = getConnection(id);
        if (!peerConnection) {
            console.error('peerConnection NOT exist!');
            return;
        }

        peerConnection.setRemoteDescription(sessionDescription)
            .then(function () {
        
            }).catch(function (err) {
                console.error('setRemoteDescription(answer) ERROR: ', err);
            });
    }

 
    function addIceCandidate(id, candidate) {
        if (!isConnectedWith(id)) {
            console.warn('NOT CONNEDTED or ALREADY CLOSED with id=' + id + ', so ignore candidate');
            return;
        }

        let peerConnection = getConnection(id);
        if (peerConnection) {
            peerConnection.addIceCandidate(candidate);
        }
        else {
            console.error('PeerConnection not exist!');
            return;
        }
    }

    
    function connect() {

        if (!isReadyToConnect()) {
            console.warn('NOT READY to connect');
        }
        else if (!canConnectMore()) {
            //console.log('TOO MANY connections');
        }
        else {
            callMe();
        }
    }


    function hangUp() {
        emitRoom({ type: 'bye' });
        stopAllConnection();
    }

   
    function callMe() {
        emitRoom({ type: 'call me' });
    }

})


     
/*以下参照用
$('#logout').click(function () {
    socket.emit('logout');
    $('#loginForm').show(1000);
    $('#chatRoom').hide(2000);

});

$('#send-message').click(function () {
    socket.emit('user-send-message', $('#message').val());
});

$('#message').focus(function () {
    socket.emit('user-typing-message');
});

$('#message').focusout(function () {
    socket.emit('user-stop-typing-message');
});


socket.on('server-send-fail', function () {
    alert('The username is already exists !');
});

socket.on('server-send-success', function (data) {
    //console.log(data);
    $('#current-user').html(data);
    $('#login-form').hide(2000);
    $('#chat-form').show(1000);
});

socket.on('server-send-array-user', function (data) {
    $('#box-content').html('');
    data.forEach(function (username) {
        $('#box-content').append('<div class="user-online"> ' + username + '</div>');
    });
});

socket.on('server-send-message', function (data) {
    $('#list-message').append('<div>' + data.username + ': ' + data.message + '</div>');
});

socket.on('server-send-typing', function (data) {
    $('#list-message').append('<div id="' + data + '">' + data + ' is typing message ... </div>');
});

socket.on('server-send-stop-typing', function (data) {
    $('#' + data).remove();
});
*/