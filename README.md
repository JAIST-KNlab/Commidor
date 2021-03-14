# Commidor
Auraの概念を取り入れたメディア空間  

## 1. Commidorで使っている技術・環境
 - プログラミング技術（JS）
 - Node.js
 - socket.io
 - Express
 - CentOS
 - p2p通信

## 2. ファイル構成
Expressを基に作成  
編集・確認するファイルは以下の6つ  
 **server.js** : 基本的にはデータをSocketを使って中継する  
 **views/home.ejs** : 部屋名とユーザ名を打ち込むためのページ　loginボタンをクリックしたらchat_room.htmlに飛ぶ  
 **public/chat_room.html** : Commidorのメイン部分  
 **public/js/chat_room.js** : chat_room.html内での動作  
 **public/js/main.js** : home.ejs内での動作  
 **public/css/layout.css** : home.ejsとchat_room.htmlの書式設定  

## 3. 環境構築
CentOS7での動作を確認済み
- node.jsのインストール
- Expressのインストール
- 使用するポートを開放する（初期設定では3000）
- さくらVPSを利用する場合はパケットも開放する必要がある

## 4.出力されるcsv
n = 日付
- **n_ConnectData.csv** : 誰が誰と通信が繋がっているのか  

<img src="https://user-images.githubusercontent.com/79554440/110875083-539a3180-8318-11eb-857b-a002c7048fec.png" width="250px">

- **n_coordinateData.csv** : Commidor内に2人以上いる場合に各ユーザの座標を取得する  

<img src="https://user-images.githubusercontent.com/79554440/110881268-6a925100-8323-11eb-91fd-f13104203a54.png" width="250px">

## 5.P2P通信について
### **P2P(Peer-to-Peer)通信** 
ブラウザとブラウザの間で直接通信する技術であり，UDP/IPを使用している  
P2P通信を行うためには，各ブラウザのIPアドレスを含む**SDP**を交換する必要がある  
↓  
交換した**SDP**を基に各ブラウザがSDPを交換した後に**ICE**候補（ICE Candidate）を生成する  
↓  
候補の中からネットワーク的に近い経路が選択され，通信が開始される  

**SDP(Session Description Protocol)** : 各ブラウザの情報を示し，文字列で表現される  
**ICE(Interactive Connectivity Establishment)** : ブラウザ間の可能な通信経路に関する情報  
詳しくは　→　https://html5experts.jp/mganeko/5181/
### **ICE候補**
Commidorでは通信経路候補として3つ用意している  
- P2Pによる直接的な通信経路
- NATをこえるために**STUNサーバー**を利用した通信経路
- **TURNサーバー**による通信経路（ブラウザ間にFireWallがある場合）


