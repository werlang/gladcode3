import CustomError from '../core/error.js';
import Db from '../core/mysql.js';

export default class User {

    // id, email, googleid, nickname, first_name, last_name, profile_picture, spoken_language, emoji
    // pasta, lvl, xp, silver, credits, active, premium, show_tutorial, editor_theme, editor_font
    // pref_message, pref_friend, pref_update, pref_duel, pref_tourn, email_update, read_news
    // pref_language, apothecary

    //Snake casing para atributos associados com o MySQL
    constructor({ id, email, googleid, nickname, first_name, last_name, profile_picture, pasta, pref_language }) {
        this.id = id,
        this.email = email,
        this.googleid = googleid,
        this.nickname = nickname,
        this.first_name = first_name,
        this.last_name = last_name,
        this.profile_picture = profile_picture,
        this.pasta = pasta;
        this.pref_language = pref_language
    };
  
    async get() {
        const user = await Db.find('users', {
            filter: { id: this.id },
            view: ['email', 'nickname', 'first_name', 'last_name', 'profile_picture']
        });
        if (user.length === 0) throw new CustomError(404, `User does not exist`);
        return user[0];
    };

    static async getNameList(name){
        if (!name) throw new CustomError(400, 'Nickname is required');

        const results = [];
        const exact = await Db.find('users', {
            filter: { nickname: name },
            view: [ 'nickname', 'profile_picture' ],
            opt: { limit: 1 }
        });
        if(exact.length === 1) results.push(exact[0]);

        const prefix = await Db.find('users', {
            filter: { nickname: Db.like( `${name}_%` ) },
            view: [ 'nickname', 'profile_picture' ],
            opt: { limit: 5 }
        });
        if(prefix.length >= 1) {
            prefix.forEach(query => {
                results.push(query);
            });
        };
        
        const suffix = await Db.find('users', {
            filter: { nickname: Db.like( `%_${name}` ) },
            view: ['nickname', 'profile_picture'],
            opt: { limit: 5 }
        });
        if(suffix.length >= 1) {
            suffix.forEach(query => {
                results.push(query);
            });
        };

        if(results.length === 0) throw new CustomError(404, "No results found.");
        return { "results": results };
    };
              
    async delete(){
        const find = await Db.find('users', {
            filter: { id: this.id },
            view: [ 'id' ],
            opt: { limit: 1 }
        });
        if(find.length === 0) throw new CustomError(404, "User not found.")
        await Db.delete('users', this.id);

        return { "message": "User has been deleted successfully." };
    };

    async add(){
        const activeTime = await utcFix();
        const sql = await Db.insert('users',
        {
            email: `${this.email}`,
            googleid: `${this.googleid}`,
            nickname: `${this.nickname}`,
            first_name: `${this.first_name}`,
            last_name: `${this.last_name}`,
            profile_picture: `${this.profile_picture}`,
            active: `${activeTime}`,
            pasta: `${this.pasta}`
        });

        this.id = sql[0].insertId;
        return { "User": this.get(), "code": 200 };
    };

    async update() {
        if (this.nickname !== undefined) await Db.update('users', { nickname: this.nickname }, this.id);
        if (this.profile_picture !== undefined) await Db.update('users', { profile_picture: this.profile_picture }, this.id);
        if (this.pref_language !== undefined) await Db.update('users', { pref_language: this.pref_language }, this.id);
        return this.get();
    }

    async loginUser(){
        try {
            if(!this.pasta) throw new CustomError(400, 'Password is required');
        
            const idCheck = await Db.find('users', {
                filter: { id: Db.like(this.id) },
                view: ['email'],
                opt: { limit: 1}
            });
            if(idCheck.length === 0) throw new CustomError(404, `User ID not found`);
    
            const pswd = await Db.find('users', {
                filter: { id: `${this.id}`}, 
                view: ['pasta'] 
            });
            if(pswd.length === 0 || this.pasta !== pswd[0].pasta) throw new CustomError(401, `Wrong username or password`);
            
            const userPayload = {
                id: `${this.id}`
            }
            return jwt.sign(userPayload, process.env.SIGN_TOKEN);

        } catch (error) {
            const code = error.code ?? 500;
            const msg = error.message ?? "Failed to login."
            return new CustomError(code, msg);
        };
    };

    async updateReadNews(){
        const activeTime = await utcFix();
        await Db.update('users', { read_news: activeTime }, this.id);
        return;
    };

    async updateActive(){
        const activeTime = await utcFix();
        await Db.update('users', { active: activeTime }, this.id);
        return;
    };

    static async fetchData(filter, value){
        if(filter === "email" && typeof(value) === "string"){
            try {
                const id = await Db.find('users', { filter: { email: value }, view: [ 'id' ], opt: { limit: 1 } });
                if(id.length === 0) throw { "code": 404, "message": "User not Found" };
                return { "code": 200, "id": id[0].id };

            } catch (error) {
                const code = error.code ?? 500;
                const msg = error.message ?? "Internal Auth Issues";
                return new CustomError(code, msg);
            };

        } else if(filter === "id"){
            try {
                const email = await Db.find('users', { filter:  { id: value }, view: [ 'email' ], opt: { limit: 1 } });
                if(email.length === 0) throw { "code": 404, "message": "User not Found" };
                return { "code": 200, "email": email[0].email };

            } catch (error) {
                const code = error.code ?? 500;
                const msg = error.message ?? "Internal Server Issues";
                return new CustomError(code, msg);
            };
        };
    };
};

async function utcFix() {
    const now = Date.now();
    const utcfix = now - (3 * 60 * 60 * 1000); 
    return Db.toDateTime(utcfix); 
};
