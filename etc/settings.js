var settings = {
    logFile:'microblog.log',
    weibo:{
        appkey:'196346996',
        secret:'4b1ee49ec3474192d9c3ed208db79a30',
        host:'api.weibo.com',
        update:'/2/statuses/update.json',
        remove:'/2/statuses/destroy.json',
        token:'/oauth2/access_token',
        password:'10658068', //�����˺ŵ�Ĭ������,
        interval:60 //ͬһ���˺ŵķ�΢���������λ��
    },
    mysql:{
        host:'172.16.33.237',
        user:'stockradar',
        password:'stockradar',
        database:'stock_radar'
    },
    queue:{
        send:'weibo_send_liujun',
        remove:'weibo_delete_liujun',
        host:'172.16.33.237',
        port:'3000',
        interval:10000 //��ѯ�������λ�Ǻ���
    },
    hook:{
        host:'172.16.33.237'    
    }
    
}

exports.settings = settings;