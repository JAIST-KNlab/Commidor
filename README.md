# Commidor
Auraの概念を取り入れたメディア空間  

#### 1. Commidorで使っている技術・環境
 - プログラミング技術（JS）
 - Node.js
 - socket.io
 - Express
 - CentOS
 - p2p通信

#### 2. ファイル構成
Expressを基に作成  
編集・確認するファイルは以下の6つ  
 **server.js** : 基本的にはデータをSocketを使って中継する  
 **views/home.ejs** : 部屋名とユーザ名を打ち込むためのページ　loginボタンをクリックしたらchat_room.htmlに飛ぶ  
 **public/chat_room.html** : Commidorのメイン部分  
 **public/js/chat_room.js** : chat_room.html内での動作  
 **public/js/main.js** : home.ejs内での動作  
 **public/css/layout.css** : home.ejsとchat_room.htmlの書式設定  

#### 3. 環境構築
CentOS7での動作を確認済み
- node.jsのインストール
- expressのインストール
- 使用するポートを開放する（初期設定では3000）
- さくらVPSを利用する場合はパケットも開放する必要がある
