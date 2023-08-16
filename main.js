const app = angular.module('YepAvatars', [])

app.config(function($sceProvider, $compileProvider, $locationProvider) {
  $locationProvider.hashPrefix('')
  if (!location.host.startsWith('localhost')) {
    $locationProvider.html5Mode({
      enabled: true,
      requireBase: false
    })
  }

  $sceProvider.enabled(false)
  $compileProvider.debugInfoEnabled(false) // more perf
})

app.controller('RootCtrl', ['$scope', '$http', '$location', '$filter', function($scope, $http, $location, $filter) {
  const vm = this
  this.loading = true
  this.loadError = false
  this.searchText = null
  this.selectedFranchises = $location.search().franchises?.split(',').filter(Boolean) || []
  this.filteredAvatars = []

  this.regenFilteredAvatars = () => {
    vm.franchises.forEach(f => f.selected = vm.selectedFranchises.includes(f.id))
    vm.filteredAvatars = vm.avatars.filter(avatar => {
      if (!vm.canShowAvatar(avatar)) {
        return false
      }

      if (vm.searchText) {
        return $filter('filter')([avatar], { title: this.searchText }).length > 0
      }

      return true
    })
  }

  vm.selectFranchise = (franchise) => {
    franchise.selected = !franchise.selected
    vm.selectedFranchises = vm.franchises.filter(f => f.selected).map(f => f.id)
    $location.search('franchises', vm.selectedFranchises.length > 0 ? vm.selectedFranchises.join(',') : null)
    vm.regenFilteredAvatars()
  }

  vm.canShowAvatar = (avatar) => {
    if (!vm.selectedFranchises.length) {
      return true
    }

    return avatar.franchises.some(f => vm.selectedFranchises.includes(f))
  }

  vm.$onInit = async () => {
    try {
      const [ franchises, avatars ] = await Promise.all([
        $http.get('https://blzprofile.akamaized.net/static/avatar/franchise/manifest.json'),
        $http.get('https://blzprofile.akamaized.net/static/avatar/account/manifest.json'),
      ])


      vm.franchises = getFranchiseData(franchises.data)
      vm.avatars = getAvatarData(avatars.data)
      vm.regenFilteredAvatars()

      console.log('Loaded avatars', vm.avatars)
      console.log('Loaded franchises', vm.franchises)
    } catch (err) {
      console.error('Failed to load avatars', err)
      vm.loadError = true
    } finally {
      vm.loading = false
      $scope.$applyAsync()
    }
  }

  function getAvatarData(data) {
    const out = []
    const franchiseMapping = {}

    for (const franchiseId in data.avatarCollection) {
      const avatarIds = data.avatarCollection[franchiseId]

      for (const avatarId of avatarIds) {
        if (!franchiseMapping[avatarId]) {
          franchiseMapping[avatarId] = []
        }

        franchiseMapping[avatarId].push(franchiseId)
      }
    }

    for (const itemId in data.avatarHashes) {
      const imageHash = data.avatarHashes[itemId]
      const title = data.avatarMetaData?.[itemId]?.name
      const franchises = franchiseMapping[itemId] || []

      out.push({
        id: itemId,
        title: title,
        franchises: franchises,
        imageUrl: getImageUrl(imageHash, 'jpg')
      })
    }

    // sort by title

    out.sort((a, b) => {
      if (a.title < b.title) {
        return -1
      }

      if (a.title > b.title) {
        return 1
      }

      return 0
    })

    return out
  }

  function getFranchiseData(data) {
    const out = []

    for (const item of data.avatarCollection) {
      const title = data.franchiseMetaData?.[item]?.title || capitalize(item)
      const imageHash = data.avatarHashes?.[`${item}@2x`] || data.avatarHashes[item]

      out.push({
        id: item,
        title: title,
        imageUrl: getImageUrl(imageHash, 'png')
      })
    }

    return out
  }

  function getImageUrl(hash, format = 'jpg') {
    if (!hash) {
      return null
    }

    return `https://blzprofile.akamaized.net/static/avatar/hashed/${hash}.${format}`
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
}])
