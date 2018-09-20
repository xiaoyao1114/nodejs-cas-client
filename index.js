function ssoServer(port,domain,clientTokenName, callbackLoginin, callbackLogout) {
    var express = require('express')
    var ConnectCas = require('./connect-cas2/index');
    var bodyParser = require('body-parser');
    var session = require('express-session');
    var cookieParser = require('cookie-parser');
    var MemoryStore = require('session-memory-store')(session);

    var app = express()
    app.use(cookieParser());
    app.use(session({
        name: 'NSESSIONID',
        secret: 'Hello I am a long long long secret',
        store: new MemoryStore(),  // or other session store
        resave:false,//强制保存session,即使它没变化
        saveUninitialized:true //强制将未初始化的session存储，默认为true
    }));
    var casClient = new ConnectCas({
        debug: true,
        ignore: [
            /\/ignore/
        ],
        match: [],
        servicePrefix: domain,
        serverPath: 'https://openshift-master.m8.ccs:8443',
        paths: {
            validate: '/cas/validate',
            serviceValidate: '/cas/p3/serviceValidate',
            proxy:'',
            proxyCallback:'',
            login: '/cas/login',
            logout: '/cas/logout',

        },

        rejectUnauthorized:false,
        restletIntegration:false,
        gateway: false,
        renew: false,
        slo: true,
        cache: {
            enable: false,
            ttl: 5 * 60 * 1000,
            filter: []
        },
        fromAjax: {
            header: 'x-client-ajax',
            status: 418
        }
    });
    app.use(casClient.core());
// NOTICE: If you want to enable single sign logout, you must use casClient middleware before bodyParser.
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    var http = require('http').Server(app)
    var path = require('path');
    app.set('views', path.join(__dirname, '../dist'));
    app.set('view engine', 'ejs');
    app.use(express.static(path.join(__dirname, '../dist')));
    var AdminToken = false
    app.get('/*', function(req, res, next) {
        //console.log('//////////',req.session.cas.user )
        // console.log('//////////',req.session.cas.st )
        if(req.url !== '/logout'){
            if(!AdminToken){
                var username = req.session.cas.user;
                var password = req.session.cas. attributes.password[0];
                callbackLoginin(username, password).then(response => {
                    console.log('//////////////',response)
                    res.setHeader('Set-Cookie', clientTokenName + '=' + response);
                    res.render('index')
                }).catch(err => {
                    res.send('登录失败')
                });
                // var loginForm = {
                //     username: req.session.cas.user,
                //     password: req.session.cas. attributes.password[0],
                //     code: '',
                //     randomStr: Math.ceil(Math.random() * 100000) + '_' + Date.now(),
                //     grant_type:'password',
                //     scope:'server'
                // }
                // let headers= {
                //     'Authorization':'Basic cGlnOnBpZw==',
                //     'content-type': 'application/x-www-form-urlencoded',
                // }
                // var paramStr=qs.stringify(loginForm);
                // request({
                //     headers:headers,
                //     url:'http://gateway.dev.m8msdp.com/auth/oauth/token',
                //     method: 'POST',
                //     body:paramStr,
                //     json: true
                // },function (error,response,body) {
                //     console.log('==================',body)
                //     if (!error && (response.statusCode == 200 || response.statusCode == 201)) {
                //         AdminToken = true
                //         res.setHeader('Set-Cookie', clientTokenName + '=' + body.access_token);
                //         res.render('index')
                //     }else {
                //         res.send('登录失败')
                //     }
                // })
            }else {
                res.render('index')
            }
        }else { //登出
            // Do whatever you like here, then call the logout middleware
            callbackLogout().then(response => {
                casClient.logout()(req, res, next);
            })
        }
    })
    if (process.env.PORT) {
        console.log('> Listening at ' + process.env.PORT + '\n')
        http.listen(process.env.PORT)
    } else {
        http.listen(port)
        console.log('> Listening at ' + port + '\n')
    }
}
module.exports = ssoServer;
