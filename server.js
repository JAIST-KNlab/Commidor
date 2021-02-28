const { ETIME } = require('constants');
let express = require('express');
let app = express();
app.use(express.static('./public'));
app.set('view engine', 'ejs');
app.set('views', './views');
let fs = require("fs");
let opt = {//ssl証明書の参照　この場合はオレオレ証明書
    key: fs.readFileSync("ssl/server.key"),
    cert: fs.readFileSync("ssl/server.crt"),
};
let server = require('https').Server(opt,app);
let io = require('socket.io')(server);
let connect = {
};
let coordinate = {};

server.listen(3000,function(){//サーバーを立ち上げる　ポート番号：3000
});

app.get('/', function (req, res) {
    res.render('home');
})


//実験データ取得用　Commidor内に二人以上いたら座標をcsvで記録する　
function exportCoordinate() {
    let date = new Date();
    let formatCSV = date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds() + ",";
    for (let i in coordinate) {
        formatCSV += i;
        formatCSV += ",";
        formatCSV += coordinate[i];
        formatCSV += ",";
    }
    formatCSV += "\n";

    fs.appendFile(date.getDate() + '_coordinateData.csv', formatCSV, 'utf8', function (err) {
        if (err) {
            console.log("保存できませんでした");
        } else {
            console.log("保存できました");
        }

    });

}

//実験データ取得用　オーラが触れているユーザをcsvで記録
function exportConnectUsers(){
        let date = new Date();
        let formatCSV =  date.getHours()+":"+date.getMinutes()+":"+date.getSeconds()+",";
        for(let i in connect){
            formatCSV += i +":"
            for(let j = 0;j < connect[i].length;j++){
                if(j != 0){
                    formatCSV += "&" 
                }
                formatCSV += connect[i][j];
            }
            formatCSV +="," 
        }        
        formatCSV += "\n"
        fs.appendFile(date.getDate()+'_ConnectData.csv',formatCSV,'utf8',function(err){
            if(err){
                console.log("保存できませんでした");
            }else{
                console.log("保存できました");
            }
            
        });
}


//ソケットの処理
io.on('connection', function (socket) {

    console.log('Client ' + socket.id + ' connected');
    
    //ログイン時の処理
    socket.on('login', function (userName, roomName) {
        socket.roomName = roomName;//部屋の名前を登録
        socket.userName = userName;//ユーザネームを登録
        socket.muteInfo = true;//ミュート情報を登録　初期値はtrue
        socket.connectFlg = false;//誰かとオーラが触れているか　初期値はfalse
        socket.join(roomName);//roomNameの部屋に入室
        //roomName内の他のユーザに，ユーザ名，id，部屋の中の人数を送る
        socket.broadcast.to(socket.roomName).emit('loginInfo', socket.userName, socket.id, io.sockets.adapter.rooms[roomName].length);
        coordinate[socket.userName] = [0, 0];
    });

    //ログインしてきたユーザーからすでに部屋内に居る相手に対してにデータを送る
    socket.on('submitData', function (id, userName,x,y,num) {
        io.to(id).emit('memberData', userName,x,y,socket.muteInfo,num);
    });

    //オブジェクトの位置情報を更新する
    socket.on('updateNode',function(x,y){
        //他ユーザに座標と移動したユーザ名を送る
        socket.broadcast.to(socket.roomName).emit('updateOtherNode', socket.userName, x, y);

        coordinate[socket.userName] = [x, y];
        if (Object.keys(coordinate).length >= 2) {
            exportCoordinate();
        }
    });

    //ミュートの切り替え処理
    socket.on('muteSwitching',function(userName,muteInfo){
        socket.muteInfo = muteInfo;
        //他ユーザにミュートを切り替えたことを知らせる
        socket.broadcast.to(socket.roomName).emit('userMuteSwitching',userName,muteInfo);
    });
    
    //実験データ取得用
    socket.on('connectEvent',function(connectUsers,first){
        try{
        if(Object.keys(connect).indexOf(socket.userName) == -1){
            connect[socket.userName] = [];
        }
        for(i = 0;i < connectUsers.length;i++){
            if(connect[socket.userName].indexOf(connectUsers[i]) == -1){ 
                        
                if(Object.keys(connect).indexOf(connectUsers[i]) != -1){
                    if(connect[connectUsers[i]].indexOf(socket.userName) == -1){
                        connect[connectUsers[i]].unshift(socket.userName);
                    }
                }else{
                    connect[connectUsers[i]] = [socket.userName];
                }
            }else{
                connect[socket.userName].splice(connect[socket.userName].indexOf(connectUsers[i]),1);
            }
        }
        for(i = 0;i < connect[socket.userName].length;i++){
            
            if(connect[connect[socket.userName][i]].length == 1){
                delete connect[connect[socket.userName][i]];
            }else{
                connect[connect[socket.userName][i]].splice(connect[connect[socket.userName][i]].indexOf(socket.userName),1);
            }
        }

        if(connectUsers.length > 0){
            connect[socket.userName] = connectUsers;
        }else{
            delete connect[socket.userName];
        }
        exportConnectUsers();
        console.log(connect);
    }catch{
        
    }
    });
    socket.on('changeDevice',function(){
        socket.broadcast.to(socket.roomName).emit('userChangeDevice',socket.userName,socket.id);
    });
    socket.on('restartConnect',function(id){
        socket.broadcast.to(id).emit('restart');
    });




    //切断時の処理
    socket.on('disconnect',function(){
        console.log((new Date())+'Peer disconnected.id ='+ socket.id);
        if(Object.keys(connect).indexOf(socket.userName) != -1){
            for(let i = 0 ;i < connect[socket.userName].length;i++){
                if(connect[connect[socket.userName][i]].length == 1){
                    delete connect[connect[socket.userName][i]];
                }else{
                    connect[connect[socket.userName][i]].splice(connect[connect[socket.userName][i]].indexOf(socket.userName),1);
                }
            }
            delete connect[socket.userName];
            exportConnectUsers();
        }
        delete coordinate[socket.userName];
        console.log(connect);

        //p2pの切断処理
        emitMessage('user disconnected',{id : socket.id,userName : socket.userName});
        if(socket.roomName){
            socket.leave(socket.roomName);
        }
        //切断したユーザ名をルーム内の全員に送信
        socket.broadcast.to(socket.roomName).emit('disconnectUser',socket.userName);
    });


    function emitMessage(type,message){
        if (socket.roomName){
            socket.broadcast.to(socket.roomName).emit(type,message);
        }
        else{
            //ルーム未入室の場合は全員に送る
            socket.broadcast.emit(type,message)
        }
    }
    
    //p2p通信を行うための処理　基本的にmessageを受けっとて送っているだけ　messageの中に送る相手のidやuserNameがある
    socket.on('message', function(message) {
        //var date = new Date();
        message.from = socket.id;
        message.userName = socket.userName
        //console.log(date + 'id=' + socket.id + ' Received Message: ' + JSON.stringify(message));

   
        var target = message.sendto;
        if (target) {
          //console.log('===== message emit to -->' + target);
          socket.to(target).emit('message', message);
          return;
        }

        // broadcast in room
        emitMessage('message', message);
    });
})

    //以下socketの参照用
    /*
      
        let huge = 0;
        let hoge = setInterval(function () {
            huge++;
            console.log(huge);
            if (huge == 10) {
                socket.emit('loginInfo', userName, roomName);
                clearInterval(hoge);
                console.log(userName);
            }
        }, 500);

        socket.on('login', function (userName, roomName) {
        if (arrayUser.indexOf(data) >= 0) {
            socket.emit('server-send-fail');
        } else {
            arrayUser.push(data);
            socket.username = data;
            socket.emit('server-send-success', data);
            io.sockets.emit('server-send-array-user', arrayUser);
        }
    });


    socket.on('logout', function () {
        arrayUser.splice(arrayUser.indexOf(socket.username), 1);
        socket.broadcast.emit('server-send-array-user', arrayUser);
    });

    socket.on('user-send-message', function (data) {
        io.sockets.emit('server-send-message', {
            username: socket.username,
            message: data
        });
    });

    socket.on('user-typing-message', function () {
        socket.broadcast.emit('server-send-typing', socket.username);
    });

    socket.on('user-stop-typing-message', function () {
        socket.broadcast.emit('server-send-stop-typing', socket.username);
    })
    */