import citeSupport from './citesupport.es6';


class SafeStorage {

    constructor(config) {
        this.config = config;
    }

    safeStorageGet(key, fallback) {
        let ret;
        const val = localStorage.getItem(key);
        if (!val) {
            console.log('No value in storage!');
            ret = fallback;
        } else if (['{', '['].indexOf(val.slice(0, 1)) > -1) {
            try {
                ret = JSON.parse(val);
            } catch (e) {
                console.log(`JSON parse error! ${key} ${val}`);
                ret = fallback;
            }
        } else {
            ret = val;
        }
        this.config[key] = ret;
        return ret;
    }

    set defaultLocale(localeName) {
        this.config.defaultLocale = localeName;
        localStorage.setItem('defaultLocale', localeName);
    }

    set defaultStyle(styleName) {
        localStorage.setItem('defaultStyle', styleName);
        this.config.defaultStyle = styleName;
    }

    set citationByIndex(citationByIndex) {
        localStorage.setItem('citationByIndex', JSON.stringify(citationByIndex));
        this.config.citationByIndex = citationByIndex;
    }

    set citationIdToPos(citationIdToPos) {
        localStorage.setItem('citationIdToPos', JSON.stringify(citationIdToPos));
        this.config.citationIdToPos = citationIdToPos;
    }

    get defaultLocale() {
        return this.safeStorageGet('defaultLocale', 'en-US');
    }

    get defaultStyle() {
        return this.safeStorageGet('defaultStyle', 'american-medical-association');
    }

    get citationByIndex() {
        return this.safeStorageGet('citationByIndex', []);
    }

    get citationIdToPos() {
        return this.safeStorageGet('citationIdToPos', {});
    }

}

// const citesupport = new CiteSupport(SafeStorage);
const citesupport = citeSupport(SafeStorage);


window.addEventListener('load', () => {
    citesupport.buildStyleMenu();
    citesupport.spoofDocument();
    citesupport.initDocument();
    citesupport.setStyleListener();
    citesupport.setPegListener();
});
