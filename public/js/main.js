//var socket = io('http://localhost:3000');

$(document).ready(function () {
    //home.ejs　loginボタンが押された場合の処理
    let query = decodeURIComponent(location.search);
    console.log(query);
    let value = query.split('=');
    let user = value[1];
    let room = value[3];
    console.log(value.length);
    if(value.length == 5){
        window.open('chat_room.html?name=' + user + '=room=' + room ,null,'top=0,left=0,width=1500,height=900,toolbar=yes,menubar=yes,scrollbars=yes');
        
        window.close();
    }


    $('#login').click(function () {
        if ($('#userName').val() == "" || $('#roomName').val() == "") {
        }
        else {
            window.location.href = 'chat_room.html?name=' + encodeURIComponent($('#userName').val()) + '=room=' + encodeURIComponent($('#roomName').val());
        }
    });
})