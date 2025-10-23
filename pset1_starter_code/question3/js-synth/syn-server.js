import express from 'express';
import { synthesize, deserializeState, deserializeType } from './src/synlib.js';
import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

function setupServer(language, scoring, port){        
    const app = express();
    
    app.use(express.json({ limit: '10mb' }));

    // POST /synthesize expects a JSON body with the necessary arguments for synthesize
    app.post('/synthesize', async (req, res) => {
        try {
            // You may want to validate/adjust these fields as needed
            let { inputspec, examples, threshold, bound, N, config } = req.body;
            inputspec = inputspec.map(x => ({...x, type: deserializeType(x.type)}));

            //If language is actually a dictionary of languages, we need to check 
            //config.language and use the appropriate language.
            let localLanguage = language;
            let localScoring = scoring;
            if(typeof language == "object"){
                if(!config.language){
                    const availableLanguages = Object.keys(language).join(', ');
                    return res.status(400).json({ 
                        error: `config.language is required when language is a dictionary. Available languages: ${availableLanguages}` 
                    });
                }
                if(config.language in language){
                    localLanguage = language[config.language];
                }else{
                    const availableLanguages = Object.keys(language).join(', ');
                    return res.status(400).json({ 
                        error: `Language '${config.language}' not found in dictionary. Available languages: ${availableLanguages}` 
                    });
                }
            }
            if(typeof scoring == "object"){
                if(config.language in scoring){
                    localScoring = scoring[config.language];
                }else{
                    const availableScorings = Object.keys(scoring).join(', ');
                    return res.status(400).json({ 
                        error: `Scoring '${config.language}' not found in dictionary. Available scorings: ${availableScorings}` 
                    });
                }
            }

            if (!examples ) {
                return res.status(400).json({ error: 'Missing required fields: examples' });
            }
            
            if(config.initialState){
                config.initialState = deserializeState(config.initialState, localLanguage);
            }
            // scoreOutputs may be undefined; synthesize will use default if so
            const result = synthesize(inputspec, examples, localLanguage, localScoring, threshold, bound, N, config);
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.toString() });
        }
    });

    app.listen(port, () => {
        console.log(`Express server listening on port ${port}`);
    }); 
}

export { setupServer };