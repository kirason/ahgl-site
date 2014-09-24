"use strict";angular.module("config",[]).constant("ENV",{name:"production",apiEndpoint:""}),angular.module("ahglApp",["config","ngAnimate","ngCookies","ngResource","ngRoute","ngSanitize","ngTouch","angular-carousel"]).config(["$routeProvider",function(a){a.when("/",{templateUrl:"views/main.html",controller:"MainCtrl"}).when("/game/:gamesSlug",{templateUrl:"views/main.html",controller:"GameCtrl"}).otherwise({redirectTo:"/"})}]),angular.module("ahglApp").controller("MainCtrl",["$scope","GamesSvc",function(a,b){b.selectGame(null)}]),angular.module("ahglApp").controller("HeaderCtrl",["$scope","GamesSvc",function(a,b){b.fetchGames().then(function(b){a.games=b}),a.$watch("GamesSvc.getSelectedGame()",function(){a.selectedGame=b.getSelectedGame(),a.isGameSelected=null!==a.selectedGame}),a.tabs=[{title:"Videos",slug:"videos"},{title:"Casters",slug:"casters"},{title:"Teams",slug:"teams"},{title:"Schedule",slug:"schedule"},{title:"Standings",slug:"videos"}],a.selectedTab=function(){if("undefined"!=typeof document){var a=document.location.pathname.match(/^\/([^\/]+)\/(\w+)\/?$/);return a?a[2]:null}}(),a.isSelected=function(a){var c=b.getSelectedGame();return c?a.slug===c:!1},a.getImageUrl=function(b){var c=b.image_url;return a.isSelected(b)?(c=c.replace(".png",""),c+"-highlight.png"):c},a.getSelectedIconUrl=function(b){if(a.isSelected(b)){var c=b.image_url;return c=c.replace(".png",""),c+"-active.png"}return null}}]),angular.module("ahglApp").controller("LiveStreamCtrl",["$scope","$sce","liveStreamSvc","urlSvc","GamesSvc",function(a,b,c,d,e){var f=e.getSelectedGame();c.fetchStreams(f).then(function(c){a.liveStream=!0,a.channel_name=c.channelName,a.chat_url=b.trustAsResourceUrl(d.chatUrl.replace("{{channelName}}",c.channelName)),a.live_stream_logo=b.trustAsResourceUrl(c.gameImageUrl),a.streamTitle=c.streamTitle,a.gameName=c.gameName,a.username=c.username}),e.fetchGames().then(function(){a.sectionHeaderIconUrl=e.getRandomIcon("live_stream")})}]),angular.module("ahglApp").controller("CarouselCtrl",["$scope","carouselSvc","$sce",function(a,b,c){a.carouselInterval=5e3,a.slides=[],b.fetchCarousels().then(function(b){b.data.results.forEach(function(b){b.message=c.trustAsHtml(b.message),a.slides.push(b)})})}]),angular.module("ahglApp").controller("FeaturedMatchesCtrl",["$scope","$sce","urlSvc","MatchSvc","GamesSvc",function(a,b,c,d,e){a.localGamesSvc=e,a.featuredMatchesPresent=!1;var f=e.getSelectedGame();d.fetchMatches(f).then(function(b){a.matches=b,a.featuredMatchesPresent=b.length>0}),e.fetchGames().then(function(){a.sectionHeaderIconUrl=e.getRandomIcon("match")}),a.isVisible=function(a){return null===a.icon_image_url?!1:!0}}]),angular.module("ahglApp").controller("LatestNewsCtrl",["$scope","$sce","urlSvc","NewsSvc","GamesSvc",function(a,b,c,d,e){a.localGamesSvc=e,a.newsPresent=!1;var f=e.getSelectedGame();d.fetchNews(f).then(function(b){a.news=b,a.newsPresent=b.length>0}),e.fetchGames().then(function(){a.sectionHeaderIconUrl=e.getRandomIcon("article")});var g=["January","February","March","April","May","June","July","August","September","October","November","December"];a.formatDate=function(a){var b=new Date(a.publish_date);if(!b)return"";var c=g[b.getMonth()-1]+" "+b.getDay()+", "+b.getFullYear();return c},a.isVisible=function(a){return null===a.icon_image_url?!1:!0}}]),angular.module("ahglApp").controller("GameCtrl",["$routeParams","GamesSvc",function(a,b){b.selectGame(a.gamesSlug)}]),angular.module("ahglApp").service("urlSvc",["ENV",function(a){this.carouselUrl=a.apiEndpoint+"/api/carousel/?format=json",this.headerInfoUrl=a.apiEndpoint+"/api/header/?format=json",this.gamesUrl=a.apiEndpoint+"/api/games/?format=json",this.streamUrl="https://api.twitch.tv/kraken/streams/{{channelName}}?callback=JSON_CALLBACK",this.chatUrl="http://twitch.tv/chat/embed?channel={{channelName}}&amp;popout_chat=false",this.matchesUrl=a.apiEndpoint+"/api/featured_matches/?format=json",this.newsUrl=a.apiEndpoint+"/api/latest_news/?format=json"}]),angular.module("ahglApp").service("liveStreamSvc",["$sce","$http","$q","urlSvc","GamesSvc",function(a,b,c,d,e){this.fetchStreams=function(a){var f=c.defer();return e.fetchGames().then(function(e){var g=[];a&&(e=_.filter(e,function(b){return b.slug===a})),e.forEach(function(a){g.push(b.jsonp(d.streamUrl.replace("{{channelName}}",a.channel_name)))}),c.all(g).then(function(a){a.some(function(a,b){if(a.data.stream){var c=e[b],d=c.channel_name,g=a.data.stream.channel.status,h=c.section_image_url;return f.resolve({channelName:d,gameImageUrl:h,username:a.data.stream.channel.display_name,gameName:a.data.stream.game,streamTitle:g}),!0}})})}),f.promise}}]),angular.module("ahglApp").service("MatchSvc",["$sce","$http","$q","urlSvc",function(a,b,c,d){this.fetchMatches=function(a){var c={};return a&&(c.game=a),b.get(d.matchesUrl,{params:c}).then(function(a){var b=_.map(a.data.results,function(a){return a});return b.slice(0,3)})}}]),angular.module("ahglApp").service("carouselSvc",["$sce","$http","$q","urlSvc",function(a,b,c,d){this.fetchCarousels=function(){return b.get(d.carouselUrl)}}]),angular.module("ahglApp").service("NewsSvc",["$sce","$http","$q","urlSvc",function(a,b,c,d){this.fetchNews=function(a){var c={};return a&&(c.game=a),b.get(d.newsUrl,{params:c}).then(function(a){return a.data.results})}}]),angular.module("ahglApp").service("GamesSvc",["$sce","$http","$q","$route","urlSvc",function(a,b,c,d,e){var f=null,g=!1,h=function(){if("undefined"!=typeof document){var a=document.location.pathname.match(/^\/([^\/]+)\/(videos|casters|teams|schedule|standings)\/?$/);return a?a[1]:null}}(),i=function(){if(g){var a=c.defer();return a.resolve(f),a.promise}return b.get(e.gamesUrl).then(function(a){return f=_.map(a.data.results,function(a){return{slug:a.slug,image_url:a.header_image_url,article_section_image_url:a.article_section_image_url,live_stream_section_image_url:a.live_stream_section_image_url,match_section_image_url:a.match_section_image_url,channel_name:a.channel_name}}),g=!0,f})},j=function(a){h=a},k=function(){return h},l=function(a){if(null===f)return"";if("article"!==a&&"match"!==a&&"live_stream"!==a)throw Exception("Invalid section provided");var b=f.length,c=Math.floor(Math.random()*b),d=f[c][a+"_section_image_url"];return d};return{games:f,selectGame:j,getSelectedGame:k,gamesPopulated:g,fetchGames:i,getRandomIcon:l}}]),angular.module("ahglApp").run(["$templateCache",function(a){a.put("views/carousel.html",'<div ng-controller=CarouselCtrl><ul rn-carousel rn-carousel-control><li ng-repeat="slide in slides"><img ng-src="{{ slide.image_url }}"><div class=mask></div><div class=fade></div><div class=message><span ng-bind-html=slide.message></span></div></li></ul></div>'),a.put("views/featuredMatches.html",'<div ng-controller=FeaturedMatchesCtrl ng-show=featuredMatchesPresent><div class=header><img class=section-header-icon ng-src="{{ sectionHeaderIconUrl }}"> <span class=heavy>Featured</span><span>Matches</span></div><div class=featured-matches><div ng-repeat="match in matches" class=match style="background-image: url( {{ match.background_image_url }} )"><img class=game-icon ng-show="{{ isVisible(match) }}" ng-src="{{ match.icon_image_url }}"> <a href="{{ match.match_url }}"><p>{{ match.home_team }}</p><p class=vs>vs</p><p>{{ match.away_team }}</p></a></div></div></div>'),a.put("views/footer.html",'<div class=bar><ul><li><a href=/ahgl-handbook>HANDBOOK</a></li><li><a href=/faq>FAQ</a></li><li><a href=/press>PRESS</a></li><li><a href=/archive>PAST SEASONS</a></li><li><a href=/leadership>LEADERSHIP</a></li><li><a href=/messages/compose/ahgltv>CONTACT</a></li></ul></div><div class=social><ul><a href=http://www.facebook.com/AHGLtv><li class=facebook></li></a> <a href=http://twitter.com/ahgltv><li class=twitter></li></a> <a href=http://www.youtube.com/afterhoursgamingtv><li class=youtube></li></a> <a href=http://www.twitch.tv/ahgltv><li class=twitch></li></a></ul></div><div class=misc><div class=terms><div><a href=/terms-of-use>TERMS OF USE</a></div><div>©2014 JINK.TV. ALL RIGHTS RESERVED</div></div><div class=icon></div><div class=built-by><div>SITE BUILT BY <b><a href="http://ntucker.me/">NATHANIEL TUCKER</a></b></div><div>AND DESIGNED BY <b><a href="http://rediceinteractive.com/">REDICE</a></b></div></div></div>'),a.put("views/header.html",'<div ng-controller=HeaderCtrl><a href="/"><div class=logo></div></a><div class=bar><div ng-repeat="game in games"><a href="/#/game/{{ game.slug }}"><img class="game1 game" ng-src="{{ getImageUrl(game) }}"></a> <img class=game-active-icon ng-if=isSelected(game) ng-src="{{ getSelectedIconUrl(game) }}"></div></div><div class=navigation ng-show=isGameSelected><ul><li ng-repeat="tab in tabs"><a href="/{{ selectedGame }}/{{ tab.slug }}" ng-class="{ selected: selectedTab == tab.slug }">{{ tab.title }}</a></li></ul></div></div>'),a.put("views/latestNews.html",'<div ng-controller=LatestNewsCtrl ng-show=newsPresent><div class=header><img class=section-header-icon ng-src="{{ sectionHeaderIconUrl }}"> <span class=heavy>Latest</span><span>Ahgl News</span></div><div class=latest-news><div ng-repeat="article in news" class=news><div class=news-heading><div class=date>{{ formatDate(article) }}</div><img ng-show="{{ isVisible(article) }}" ng-src="{{ article.icon_image_url }}"><div>{{ article.title }}</div><div class=underline></div></div><p ng-bind-html=article.summary></p><a href="{{ article.page_url }}">Read More</a></div></div></div>'),a.put("views/liveStream.html",'<div ng-controller=LiveStreamCtrl class=live-stream ng-show=liveStream><div class=header><img class=section-header-icon ng-src="{{ sectionHeaderIconUrl }}"> <span class=heavy>Live</span><span>stream</span></div><div class=title-container><div class=title>{{streamTitle}}</div><div class=currently-playing>{{ username }} playing {{ gameName }}</div></div><div class=stream-container><object type=application/x-shockwave-flash height=500 width=600 id=live_embed_player_flash data="http://www.twitch.tv/widgets/live_embed_player.swf?channel={{channel_name}}" bgcolor=#000000 class=twitch-container><param name=allowFullScreen value="true"><param name=allowScriptAccess value="always"><param name=allowNetworking value="all"><param name=movie value="http://www.twitch.tv/widgets/live_embed_player.swf"><param name=flashvars value="hostname=www.twitch.tv&channel={{channel_name}}&auto_play=true&start_volume=50"></object><iframe class=chat-container frameborder=0 scrolling=no id=chat_embed ng-src={{chat_url}}></iframe></div></div>'),a.put("views/main.html",'<div class=carousel ng-include="\'views/carousel.html\'"></div><header ng-include="\'views/header.html\'"></header><div class=content><div class="section live-stream" ng-include="\'views/liveStream.html\'"></div><div class=section ng-include="\'views/featuredMatches.html\'"></div><div class=section ng-include="\'views/latestNews.html\'"></div><footer ng-include="\'views/footer.html\'"></footer></div><br>')}]);