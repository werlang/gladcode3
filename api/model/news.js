import Db from '../core/mysql.js';
import CustomError from '../core/error.js';
export default class News {

    constructor({ id, title, time, post}){
        this.id = id;
        this.title = title;
        this.time = time;
        this.post = post;
    }

    static async get(page, qnt){
        if(!page) throw { "code": 400, "message": "Page was not sent." };
        if(!qnt) throw { "code": 400, "message": "No limit was sent."};
        try{
            const pageQuery = (page*qnt)-qnt
            const news = await Db.find('news', 
                {
                    filter: {id: Db.like("%")}, 
                    view: ['id'],
                    opt: { limit: qnt, order: { id: -1}, skip: pageQuery },
                    skip: pageQuery
                }
            );
            if(news.length === 0) throw { "code": 404, "message": "Page contains no posts."};

            const jsonNews = JSON.stringify(news);
            return { "code": 200, "news": jsonNews };
            
        }catch(error){
            const code = error.code ?? 500;
            const msg = error.message ?? "Failed to retrieve news";
            return new CustomError(code, msg);
        };
    };

    // Não cheguei a usar nada da classe;
    // Ao meu ver, pegar ítems associados com o hash não é algo específico de algum post, e sim do sistema como um todo.
    static async getByHash(id){
        const posts = { 
            "prevPost": null,
            "currentPost": null,
            "nextPost": null
        };
        try {
            const news = await Db.find('news', 
                {
                    filter: { id: id },
                    view: ['id', 'title', 'time', 'post'],
                    opt: { limit: 1, }
                });
            
            if(news.length === 0) return { "code": 404, "message": `No posts were found: Id: ${id} `};
            if(news.length === 1) posts.currentPost = news[0];
            
            const prevNews = await News.fetchPrevPost(news[0].time);
            if(prevNews.length === 1) posts.prevPost = prevNews[0];

            const nextNews = await News.fetchNextPost(news[0].time);
            if(nextNews.length === 1) posts.nextPost = nextNews[0];

        } catch (error) {
            const code = error.code ?? 500;
            const msg = error.message ?? "Failed to retrieve news";
            return new CustomError(code, msg);
        }
        const resPosts = cleanPostObj(posts);
        return resPosts;
    }

    static async fetchPrevPost(basetime){
    try {
        const prevNews = await Db.find('news',
            {
                filter: { time: {'<': basetime} },
                view: ['id', 'title', 'time', 'post'],
                opt: { limit: 1,  order: {time: -1}}
            }
        );
        if(prevNews.length === 1) return prevNews;

        } catch (error) {
            const code = error.code ?? 500;
            const msg = error.message ?? "Failed to retrieve news"
            return new CustomError(code, msg);
        };
        return false;
    };

    static async fetchNextPost(basetime){
        try{
            const nextNews = await Db.find('news',
                {
                    filter: { time: {'>': basetime} },
                    view: ['id', 'title', 'time', 'post'],
                    opt: { limit: 1 }
                }
            );
            if(nextNews.length === 1) return nextNews;

        } catch(error){
            const code = error.code ?? 500;
            const msg = error.message ?? "Failed to retrieve news"
            return new CustomError(code, msg);
        }

        return false;
    }
}

function cleanPostObj(obj){
    const newObj = {}
    if(obj.prevPost !== null) newObj.prevPost = obj.prevPost;
    if(obj.currentPost !== null) newObj.currentPost = obj.currentPost;
    if(obj.nextPost !== null) newObj.nextPost = obj.nextPost
    newObj.code = 200;

    return newObj;
}